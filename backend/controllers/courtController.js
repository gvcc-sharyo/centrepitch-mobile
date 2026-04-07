// ==========================================
// controllers/courtController.js
// Court Management Controller
// ==========================================

import Court from '../models/Court.js';
import SportsAcademy from '../models/SportsAcademy.js';
import KYC from '../models/Kyc.js';
import ApprovalLog from '../models/ApprovalLog.js';
import { uploadToR2 } from '../services/cloudflareService.js';

const summarizeSportSpecificForAudit = (ssd) => {
  if (!ssd || typeof ssd !== 'object') return { keys: [], hasSportMedia: false };
  const keys = Object.keys(ssd).filter((k) => !['sportMedia', 'sportSpecifications'].includes(k));
  return {
    keys: keys.slice(0, 50),
    hasSportMedia: Boolean(ssd.sportMedia && typeof ssd.sportMedia === 'object'),
  };
};

const snapshotCourtForAudit = (doc) => ({
  name: doc?.name,
  description: doc?.description,
  courtType: doc?.courtType,
  surfaceType: doc?.surfaceType,
  capacity: doc?.capacity,
  pricing: doc?.pricing,
  amenities: doc?.amenities,
  imageCount: Array.isArray(doc?.images) ? doc.images.length : 0,
  sportType: doc?.sportType ? String(doc.sportType) : '',
  sportTypes: Array.isArray(doc?.sportTypes) ? doc.sportTypes.map((id) => String(id)) : [],
  sportSpecific: summarizeSportSpecificForAudit(doc?.sportSpecificDetails),
});

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSportIds = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((item) => String(item || '').trim()).filter(Boolean))];
      }
    } catch {
      // fall through
    }
    return [trimmed];
  }
  if (value) return [String(value).trim()].filter(Boolean);
  return [];
};

const safeCreateCourtAuditLog = async ({
  court,
  req,
  action,
  previousStatus,
  newStatus,
  reason,
  notes,
  metadata,
}) => {
  try {
    if (!court?._id || !req?.user?._id || !action) return;
    await ApprovalLog.createLog({
      entityType: 'COURT',
      entityId: court._id,
      action,
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus,
      reason,
      notes,
      metadata,
    });
  } catch (logError) {
    console.error('Court audit log write failed:', logError);
  }
};

// ==========================================
// PUBLIC LISTING
// ==========================================

/**
 * @desc    Get all approved courts (Public)
 * @route   GET /api/courts/public
 * @access  Public
 */
export const getPublicCourts = async (req, res) => {
  try {
    const { sportType, courtType, city, academy, page = 1, limit = 10 } = req.query;

    let query = { status: 'APPROVED', isActive: true };

    if (sportType) {
      query.$or = [
        { sportType },
        { sportTypes: sportType }
      ];
    }

    if (courtType) {
      query.courtType = courtType.toUpperCase();
    }

    if (academy) {
      query.academy = academy;
    } else if (city && String(city).trim()) {
      const term = escapeRegex(String(city).trim());
      const rx = new RegExp(term, 'i');
      const matchingAcademies = await SportsAcademy.find({
        $or: [
          { 'address.city': rx },
          { 'address.state': rx },
          { 'address.country': rx },
          { name: rx },
        ],
      })
        .select('_id')
        .lean();
      const academyIds = matchingAcademies.map((a) => a._id);
      query.academy = { $in: academyIds.length > 0 ? academyIds : [] };
    }

    const courts = await Court.find(query)
      .populate('sportType', 'name slug')
      .populate('sportTypes', 'name slug')
      .populate('academy', 'name logo address')
      .select('-kycDocuments')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ averageRating: -1, createdAt: -1 });

    const count = await Court.countDocuments(query);

    res.status(200).json({
      success: true,
      count: courts.length,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: courts
    });
  } catch (error) {
    console.error('Get public courts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching courts',
      error: error.message
    });
  }
};

/**
 * @desc    Get single court details (Public)
 * @route   GET /api/courts/public/:id
 * @access  Public
 */
export const getPublicCourtById = async (req, res) => {
  try {
    const court = await Court.findOne({
      _id: req.params.id,
      status: 'APPROVED',
      isActive: true
    })
      .populate('sportType', 'name slug')
      .populate('sportTypes', 'name slug')
      .populate('academy', 'name logo address phone email')
      .select('-kycDocuments');

    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    res.status(200).json({
      success: true,
      data: court
    });
  } catch (error) {
    console.error('Get public court error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching court details',
      error: error.message
    });
  }
};

// ==========================================
// ACADEMY ADMIN OPERATIONS
// ==========================================

/**
 * @desc    Create new court
 * @route   POST /api/courts
 * @access  Private/AcademyAdmin
 */
export const createCourt = async (req, res) => {
  try {
    const {
      name,
      description,
      sportType,
      sportTypes,
      courtType,
      surfaceType,
      dimensions,
      location,
      capacity,
      amenities,
      images,
      pricing,
      availability,
      bookingSettings,
      rules,
      sportSpecificDetails
    } = req.body;

    // Get academy from authenticated user
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: 'Academy not found'
      });
    }

    if (academy.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Academy must be approved before creating courts'
      });
    }

    const normalizedSports = normalizeSportIds(sportTypes);
    const primarySport = String(sportType || normalizedSports[0] || '').trim();
    if (!primarySport) {
      return res.status(400).json({
        success: false,
        message: 'At least one sport is required'
      });
    }

    // Create court - Academy has full control, courts go live immediately
    const court = await Court.create({
      name,
      description,
      academy: academy._id,
      sportType: primarySport,
      sportTypes: normalizedSports.length > 0 ? normalizedSports : [primarySport],
      courtType,
      surfaceType,
      dimensions,
      location,
      capacity,
      amenities,
      images,
      pricing,
      availability,
      bookingSettings,
      rules,
      sportSpecificDetails,
      status: 'APPROVED',
      approvedAt: Date.now()
    });

    await safeCreateCourtAuditLog({
      court,
      req,
      action: 'APPROVED',
      previousStatus: null,
      newStatus: court.status,
      notes: 'Court created and published by academy admin',
      metadata: {
        source: 'createCourt',
        sportType: String(court.sportType || ''),
        sportTypes: Array.isArray(court.sportTypes) ? court.sportTypes.map((id) => String(id)) : [],
      },
    });

    // Add court to academy
    academy.courts.push(court._id);
    await academy.save();

    res.status(201).json({
      success: true,
      message: 'Court created successfully',
      data: court
    });
  } catch (error) {
    console.error('Create court error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating court',
      error: error.message
    });
  }
};

/**
 * @desc    Bulk create courts for a sport with images
 * @route   POST /api/courts/bulk
 * @access  Private/AcademyAdmin
 */
export const bulkCreateCourts = async (req, res) => {
  try {
    // courts is a JSON string from FormData
    const courtsData = JSON.parse(req.body.courts || '[]');
    const normalizedSports = normalizeSportIds(req.body.sportTypes);
    const primarySport = String(req.body.sportType || normalizedSports[0] || '').trim();
    const saveAsDraft = req.body.saveAsDraft === 'true';

    if (!primarySport) {
      return res.status(400).json({
        success: false,
        message: 'At least one sport is required'
      });
    }

    if (!courtsData.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one court is required'
      });
    }

    // Get academy from authenticated user
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: 'Academy not found'
      });
    }

    if (academy.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Academy must be approved before creating courts'
      });
    }

    // Process uploaded images - group by court index
    // Files come as courtImages with originalname or fieldname containing court index
    const imagesByCourtIndex = {};
    const uploadedUrlsByFileIndex = {};
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // The frontend sends courtIndex in the file's originalname prefix like "court_0_imagename.jpg"
        // Or we can use a custom header. Let's parse from the request body mapping.
        // We'll use a mapping sent from frontend: imageMapping = { "0": [0,1,2], "1": [3,4] }
        // Actually simpler: frontend will send courtIndex for each file
      }

      // Parse image mapping from request body
      const imageMapping = JSON.parse(req.body.imageMapping || '{}');
      
      for (let fileIdx = 0; fileIdx < req.files.length; fileIdx++) {
        const file = req.files[fileIdx];
        // Find which court this file belongs to
        for (const [courtIdx, fileIndices] of Object.entries(imageMapping)) {
          if (fileIndices.includes(fileIdx)) {
            if (!imagesByCourtIndex[courtIdx]) {
              imagesByCourtIndex[courtIdx] = [];
            }
            // Upload to R2
            const result = await uploadToR2(file, 'court-images');
            uploadedUrlsByFileIndex[fileIdx] = result.url;
            imagesByCourtIndex[courtIdx].push({
              url: result.url,
              caption: file.originalname,
              isPrimary: imagesByCourtIndex[courtIdx].length === 0
            });
            break;
          }
        }
      }
    }

    // Per-court media: images come from imageMapping + uploads only.
    // YouTube / extra sportMedia URLs must be inside each court's sportSpecificDetails JSON from the client.

    // Create courts
    const createdCourts = [];
    for (let i = 0; i < courtsData.length; i++) {
      const courtInfo = courtsData[i];
      const courtImages = imagesByCourtIndex[i.toString()] || [];

      // Create court - status depends on saveAsDraft flag
      const courtStatus = saveAsDraft ? 'DRAFT' : 'APPROVED';
      const mergedDetails = { ...(courtInfo.sportSpecificDetails || {}) };
      const court = await Court.create({
        name: courtInfo.name,
        description: courtInfo.description || '',
        academy: academy._id,
        sportType: primarySport,
        sportTypes: normalizedSports.length > 0 ? normalizedSports : [primarySport],
        courtType: courtInfo.courtType || 'INDOOR',
        surfaceType: courtInfo.surfaceType || 'OTHER',
        dimensions: courtInfo.dimensions || {},
        capacity: parseInt(courtInfo.capacity) || 10,
        amenities: courtInfo.amenities || [],
        images: courtImages,
        pricing: courtInfo.pricing || { hourlyRate: 0, currency: 'INR' },
        availability: courtInfo.availability || {},
        sportSpecificDetails: mergedDetails,
        status: courtStatus,
        approvedAt: saveAsDraft ? undefined : Date.now()
      });

      await safeCreateCourtAuditLog({
        court,
        req,
        action: saveAsDraft ? 'PENDING' : 'APPROVED',
        previousStatus: null,
        newStatus: courtStatus,
        notes: saveAsDraft
          ? 'Court created as draft via bulk create'
          : 'Court created and published via bulk create',
        metadata: {
          source: 'bulkCreateCourts',
          sportType: String(court.sportType || ''),
          sportTypes: Array.isArray(court.sportTypes) ? court.sportTypes.map((id) => String(id)) : [],
        },
      });

      academy.courts.push(court._id);
      createdCourts.push(court);
    }

    await academy.save();

    res.status(201).json({
      success: true,
      message: `${createdCourts.length} court(s) ${saveAsDraft ? 'saved as draft' : 'created and published'}`,
      data: createdCourts
    });
  } catch (error) {
    console.error('Bulk create courts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating courts',
      error: error.message
    });
  }
};

/**
 * @desc    Get courts by academy
 * @route   GET /api/courts/academy/:academyId
 * @access  Private/AcademyAdmin or SuperAdmin
 */
export const getCourtsByAcademy = async (req, res) => {
  try {
    const { academyId } = req.params;

    const courts = await Court.find({ academy: academyId })
      .populate('sportType', 'name slug')
      .populate('sportTypes', 'name slug')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courts.length,
      data: courts
    });
  } catch (error) {
    console.error('Get courts by academy error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching courts',
      error: error.message
    });
  }
};

/**
 * @desc    Get my courts (Academy Admin)
 * @route   GET /api/courts/my
 * @access  Private/AcademyAdmin
 */
export const getMyCourts = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: 'Academy not found'
      });
    }

    const courts = await Court.find({ academy: academy._id })
      .populate('sportType', 'name slug')
      .populate('sportTypes', 'name slug')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courts.length,
      data: courts
    });
  } catch (error) {
    console.error('Get my courts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching courts',
      error: error.message
    });
  }
};

/**
 * @desc    Update court
 * @route   PUT /api/courts/:id
 * @access  Private/AcademyAdmin or SuperAdmin
 */
export const updateCourt = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);

    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    // Academy admin can only update their own courts
    if (req.user.role === 'academyadmin') {
      const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
      if (!academy || court.academy.toString() !== academy._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const previousSnapshot = snapshotCourtForAudit(court.toObject({ depopulate: true }));

    const {
      name,
      description,
      sportType,
      sportTypes,
      courtType,
      surfaceType,
      dimensions,
      location,
      capacity,
      amenities,
      images,
      pricing,
      availability,
      bookingSettings,
      rules,
      sportSpecificDetails
    } = req.body;

    if (name) court.name = name;
    if (description !== undefined) court.description = description;
    if (sportType || sportTypes) {
      const normalizedSports = normalizeSportIds(sportTypes);
      const primarySport = String(sportType || normalizedSports[0] || '').trim();
      if (!primarySport) {
        return res.status(400).json({
          success: false,
          message: 'At least one sport is required'
        });
      }
      court.sportType = primarySport;
      court.sportTypes = normalizedSports.length > 0 ? normalizedSports : [primarySport];
    }
    if (courtType) court.courtType = courtType;
    if (surfaceType) court.surfaceType = surfaceType;
    if (dimensions) court.dimensions = dimensions;
    if (location) court.location = location;
    if (capacity) court.capacity = capacity;
    if (amenities) court.amenities = amenities;
    if (images) court.images = images;
    if (pricing) court.pricing = pricing;
    if (availability) court.availability = availability;
    if (bookingSettings) court.bookingSettings = bookingSettings;
    if (rules) court.rules = rules;
    if (sportSpecificDetails) court.sportSpecificDetails = sportSpecificDetails;

    const prevStatus = court.status;
    await court.save();

    const afterSnapshot = snapshotCourtForAudit(court.toObject({ depopulate: true }));

    await safeCreateCourtAuditLog({
      court,
      req,
      action: 'PENDING',
      previousStatus: prevStatus,
      newStatus: court.status,
      notes: 'Court profile updated (specs, media, pricing, amenities)',
      metadata: {
        source: 'updateCourt',
        beforeSnapshot: previousSnapshot,
        afterSnapshot,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Court updated successfully',
      data: court
    });
  } catch (error) {
    console.error('Update court error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating court',
      error: error.message
    });
  }
};

/**
 * @desc    Legacy submit endpoint (approval removed; publish is subscription-driven)
 * @route   PUT /api/courts/:id/submit
 * @access  Private/AcademyAdmin
 */
export const submitCourtForApproval = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);

    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }

    if (court.status !== 'DRAFT' && court.status !== 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: `Cannot publish a court with status "${court.status}". Only Draft or Rejected courts can be published.`,
      });
    }

    const previousStatus = court.status;
    court.status = 'APPROVED';
    court.rejectionReason = undefined;
    court.approvedAt = Date.now();
    await court.save();

    await safeCreateCourtAuditLog({
      court,
      req,
      action: 'APPROVED',
      previousStatus,
      newStatus: 'APPROVED',
      notes: 'Court published (legacy submit endpoint)',
      metadata: { source: 'submitCourtForApproval', legacyEndpoint: true },
    });

    res.json({
      success: true,
      message: 'Court published successfully. Superadmin approval is no longer required.',
      data: court,
    });
  } catch (error) {
    console.error('Submit court error:', error);
    res.status(500).json({ success: false, message: 'Error submitting court', error: error.message });
  }
};

/**
 * @desc    Upload KYC documents
 * @route   POST /api/courts/:id/kyc
 * @access  Private/AcademyAdmin
 */
export const uploadKYCDocuments = async (req, res) => {
  try {
    const { documents } = req.body;

    if (!documents || documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one document is required'
      });
    }

    const court = await Court.findById(req.params.id);

    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    let kyc = await KYC.findOne({
      entityType: 'COURT',
      entityId: court._id
    });

    if (!kyc) {
      kyc = await KYC.create({
        entityType: 'COURT',
        entityId: court._id,
        documents: documents.map(doc => ({
          ...doc,
          verificationStatus: 'PENDING'
        })),
        overallStatus: 'PENDING',
        submittedAt: Date.now()
      });
    } else {
      kyc.documents.push(...documents.map(doc => ({
        ...doc,
        verificationStatus: 'PENDING'
      })));
      kyc.overallStatus = 'PENDING';
      kyc.submittedAt = Date.now();
      await kyc.save();
    }

    court.kycDocuments = kyc._id;
    const previousStatus = court.status;
    court.kycStatus = 'PENDING';
    await court.save();

    await safeCreateCourtAuditLog({
      court,
      req,
      action: 'PENDING',
      previousStatus,
      newStatus: court.status,
      notes: 'Court KYC documents uploaded',
      metadata: {
        source: 'uploadKYCDocuments',
        kycId: String(kyc._id),
        approvalFlowRemoved: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'KYC documents uploaded successfully',
      data: kyc
    });
  } catch (error) {
    console.error('Upload KYC error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading KYC documents',
      error: error.message
    });
  }
};

// ==========================================
// SUPER ADMIN OPERATIONS
// ==========================================

/**
 * @desc    Get all courts (Super Admin)
 * @route   GET /api/courts
 * @access  Private/SuperAdmin
 */
export const getAllCourts = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = {};
    if (status) {
      query.status = status.toUpperCase();
    }

    const courts = await Court.find(query)
      .populate('sportType', 'name')
      .populate('sportTypes', 'name')
      .populate('academy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Court.countDocuments(query);
    const analyticsRows = await Court.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
    const activeCount = await Court.countDocuments({ isActive: true });
    const inactiveCount = await Court.countDocuments({ isActive: false });
    const analyticsByStatus = analyticsRows.reduce((acc, row) => {
      if (row?._id) {
        acc[row._id] = Number(row.count || 0);
      }
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      count: courts.length,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: courts,
      analytics: {
        total: await Court.countDocuments({}),
        active: activeCount,
        inactive: inactiveCount,
        live: Number(analyticsByStatus.APPROVED || 0),
        maintenance: Number(analyticsByStatus.MAINTENANCE || 0),
        draft: Number(analyticsByStatus.DRAFT || 0),
        rejected: Number(analyticsByStatus.REJECTED || 0),
        suspended: Number(analyticsByStatus.SUSPENDED || 0),
      },
    });
  } catch (error) {
    console.error('Get all courts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching courts',
      error: error.message
    });
  }
};

/**
 * @desc    Get pending courts (deprecated for courts; approval flow removed)
 * @route   GET /api/courts/pending
 * @access  Private/SuperAdmin
 */
export const getPendingCourts = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      count: 0,
      data: [],
      message: 'Court approval queue is deprecated. Court publish is now subscription-validated.'
    });
  } catch (error) {
    console.error('Get pending courts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending courts',
      error: error.message
    });
  }
};

/**
 * @desc    Approve court (deprecated)
 * @route   PUT /api/courts/:id/approve
 * @access  Private/SuperAdmin or AcademyAdmin
 */
export const approveCourt = async (req, res) => {
  try {
    res.status(410).json({
      success: false,
      code: 'COURT_APPROVAL_REMOVED',
      message: 'Superadmin court approval is removed. Court publish is now controlled by subscription validation.'
    });
  } catch (error) {
    console.error('Approve court error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving court',
      error: error.message
    });
  }
};

/**
 * @desc    Reject court (deprecated)
 * @route   PUT /api/courts/:id/reject
 * @access  Private/SuperAdmin
 */
export const rejectCourt = async (req, res) => {
  try {
    res.status(410).json({
      success: false,
      code: 'COURT_APPROVAL_REMOVED',
      message: 'Court rejection flow is removed. Use unpublish/maintenance controls at academy level.'
    });
  } catch (error) {
    console.error('Reject court error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting court',
      error: error.message
    });
  }
};

/**
 * @desc    Delete court (Soft delete)
 * @route   DELETE /api/courts/:id
 * @access  Private/SuperAdmin or AcademyAdmin
 */
export const deleteCourt = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);

    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    const previousStatus = court.status;
    court.isActive = false;
    await court.save();

    await safeCreateCourtAuditLog({
      court,
      req,
      action: 'REVOKED',
      previousStatus,
      newStatus: court.status,
      notes: 'Court deactivated (soft delete)',
      metadata: {
        source: 'deleteCourt',
        isActive: false,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Court deactivated successfully'
    });
  } catch (error) {
    console.error('Delete court error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting court',
      error: error.message
    });
  }
};

/**
 * @desc    Set court to maintenance mode (APPROVED -> MAINTENANCE)
 * @route   PUT /api/courts/:id/maintenance
 * @access  Private/AcademyAdmin
 */
export const setCourtMaintenance = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);

    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || court.academy.toString() !== academy._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (court.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Only approved (live) courts can be set to maintenance'
      });
    }

    const { reason } = req.body;
    const previousStatus = court.status;
    court.status = 'MAINTENANCE';
    if (reason) {
      court.maintenanceSchedule.push({ from: new Date(), to: new Date('2099-12-31'), reason });
    }
    await court.save();

    await safeCreateCourtAuditLog({
      court,
      req,
      action: 'SUSPENDED',
      previousStatus,
      newStatus: 'MAINTENANCE',
      reason: reason || undefined,
      notes: 'Court moved to maintenance mode',
      metadata: { source: 'setCourtMaintenance' },
    });

    res.status(200).json({
      success: true,
      message: 'Court set to maintenance mode',
      data: court
    });
  } catch (error) {
    console.error('Set court maintenance error:', error);
    res.status(500).json({ success: false, message: 'Error updating court status', error: error.message });
  }
};

/**
 * @desc    Set court back to live (MAINTENANCE -> APPROVED)
 * @route   PUT /api/courts/:id/go-live
 * @access  Private/AcademyAdmin
 */
export const setCourtLive = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);

    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || court.academy.toString() !== academy._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (court.status !== 'MAINTENANCE') {
      return res.status(400).json({
        success: false,
        message: 'Only courts in maintenance can be set to live'
      });
    }

    const previousStatus = court.status;
    court.status = 'APPROVED';
    const lastSchedule = court.maintenanceSchedule[court.maintenanceSchedule.length - 1];
    if (lastSchedule) {
      lastSchedule.to = new Date();
    }
    await court.save();

    await safeCreateCourtAuditLog({
      court,
      req,
      action: 'APPROVED',
      previousStatus,
      newStatus: 'APPROVED',
      notes: 'Court moved from maintenance to live',
      metadata: { source: 'setCourtLive' },
    });

    res.status(200).json({
      success: true,
      message: 'Court is now live and accepting bookings',
      data: court
    });
  } catch (error) {
    console.error('Set court live error:', error);
    res.status(500).json({ success: false, message: 'Error updating court status', error: error.message });
  }
};

/**
 * @desc    Toggle court publish status (DRAFT ↔ APPROVED)
 * @route   PUT /api/courts/:id/toggle-publish
 * @access  Private/AcademyAdmin
 */
export const toggleCourtPublish = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);

    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || court.academy.toString() !== academy._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Only allow toggling between DRAFT and APPROVED
    if (court.status !== 'DRAFT' && court.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: `Cannot toggle publish status for courts in "${court.status}" state. Only Draft or Approved courts can be toggled.`
      });
    }

    const previousStatus = court.status;
    if (court.status === 'DRAFT') {
      court.status = 'APPROVED';
      court.approvedAt = Date.now();
    } else {
      court.status = 'DRAFT';
    }
    await court.save();

    await safeCreateCourtAuditLog({
      court,
      req,
      action: court.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
      previousStatus,
      newStatus: court.status,
      notes: 'Court publish status toggled',
      metadata: { source: 'toggleCourtPublish' },
    });

    res.status(200).json({
      success: true,
      message: court.status === 'APPROVED' ? 'Court is now published and visible' : 'Court is now unpublished (draft)',
      data: court
    });
  } catch (error) {
    console.error('Toggle court publish error:', error);
    res.status(500).json({ success: false, message: 'Error toggling publish status', error: error.message });
  }
};

/**
 * @desc    Get court by ID
 * @route   GET /api/courts/:id
 * @access  Private
 */
export const getCourtById = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id)
      .populate('sportType', 'name slug')
      .populate('sportTypes', 'name slug')
      .populate('academy', 'name logo address');

    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    res.status(200).json({
      success: true,
      data: court
    });
  } catch (error) {
    console.error('Get court by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching court',
      error: error.message
    });
  }
};

/**
 * @desc    Audit / history for a court (ApprovalLog entries)
 * @route   GET /api/courts/:id/audit-history
 * @access  Private (Academy admin for own courts, SuperAdmin for any)
 */
export const getCourtAuditHistory = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id).select('academy');

    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }

    if (req.user.role === 'academyadmin') {
      const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
      if (!academy || court.academy.toString() !== academy._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const history = await ApprovalLog.getHistory('COURT', court._id);

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error('Get court audit history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching court history',
      error: error.message,
    });
  }
};