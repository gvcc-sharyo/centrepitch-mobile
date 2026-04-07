import mongoose from 'mongoose';
import Sport from '../models/Sport.js';
import Event from '../models/Event.js';
import SportAuditTrail from '../models/SportAuditTrail.js';
import SportConfiguration from '../models/SportConfiguration.js';
import { buildMemberUiOptionsFromSport } from '../constants/teamMemberUiDefaults.js';

const toSnapshot = (doc) => {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') {
    return doc.toObject({ depopulate: true, virtuals: false });
  }
  return doc;
};

const runInBackground = (label, fn) => {
  Promise.resolve()
    .then(fn)
    .catch((error) => {
      console.error(`${label} failed:`, error.message);
    });
};

const logSportAudit = ({
  sportModel = 'Sport',
  sportId,
  ownerUser = null,
  action,
  actorUser,
  actorRole = null,
  before = null,
  after = null,
  metadata = {}
} = {}) => {
  if (!sportId || !actorUser || !action) return;
  runInBackground('Sport audit log', async () => {
    await SportAuditTrail.create({
      sportModel,
      sportId,
      ownerUser,
      action,
      actorUser,
      actorRole,
      before,
      after,
      metadata
    });
  });
};

// @desc    Create a new sport
// @route   POST /api/sports
// // @access  Private (Super Admin only)
// export const createSport = async (req, res) => {
//   try {
//     const {
//       name,
//       description,
//       icon,
//       image,
//       formats,
//       teamSettings,
//       categories,
//       categorySettings, 
//       scoringSystem,
//       matchSettings,
//       rules,
//       equipment,
//       venueRequirements,
//       isFeatured
//     } = req.body;

//     // Check if sport with same name exists
//     const existingSport = await Sport.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
//     if (existingSport) {
//       return res.status(400).json({
//         success: false,
//         message: 'A sport with this name already exists'
//       });
//     }

//     const cleanedCategories = (categories || []).map(cat => {
//   const cleanCat = { ...cat };
//   Object.keys(cleanCat).forEach(key => {
//     if (cleanCat[key] === undefined || cleanCat[key] === '') {
//       delete cleanCat[key];
//     }
//   });
//   return cleanCat;
// });

//     const sport = await Sport.create({
//       name,
//       description,
//       icon,
//       image,
//       formats,
//       teamSettings,
//       categorySettings,  // <-- Added this
//   categories: cleanedCategories, 
//       scoringSystem,
//       matchSettings,
//       rules,
//       equipment,
//       venueRequirements,
//       isFeatured,
//       createdBy: req.user._id
//     });

//     res.status(201).json({
//       success: true,
//       message: 'Sport created successfully',
//       data: sport
//     });
//   } catch (error) {
//     console.error('Create sport error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };

// @desc    Get all sports
// @route   GET /api/sports
// @access  Public (with filters for admin)
// export const getSports = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 20,
//       search,
//       format,
//       isActive,
//       isFeatured,
//       sortBy = 'name',
//       sortOrder = 'asc'
//     } = req.query;

//     const query = {};

//     // For public access, only show active sports
//     if (req.user?.role !== 'superadmin') {
//       query.isActive = true;
//     } else if (isActive !== undefined) {
//       query.isActive = isActive === 'true';
//     }

//     if (search) {
//       query.$or = [
//         { name: new RegExp(search, 'i') },
//         { description: new RegExp(search, 'i') }
//       ];
//     }

//     if (format) {
//       query[`formats.${format}.enabled`] = true;
//     }

//     if (isFeatured !== undefined) {
//       query.isFeatured = isFeatured === 'true';
//     }

//     const sortOptions = {};
//     sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

//     const sports = await Sport.find(query)
//       .sort(sortOptions)
//       .skip((page - 1) * limit)
//       .limit(Number(limit))
//       .populate('createdBy', 'firstName lastName');

//     const total = await Sport.countDocuments(query);

//     res.json({
//       success: true,
//       data: sports,
//       pagination: {
//         current: Number(page),
//         pages: Math.ceil(total / limit),
//         total
//       }
//     });
//   } catch (error) {
//     console.error('Get sports error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };

// @desc    Get single sport by ID or slug
// @route   GET /api/sports/:identifier
// @access  Public
export const getSportById = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Try to find by ID first, then by slug
    let sport;
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      sport = await Sport.findById(identifier).populate('createdBy', 'firstName lastName');
    }
    
    if (!sport) {
      sport = await Sport.findOne({ slug: identifier }).populate('createdBy', 'firstName lastName');
    }

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Sport not found'
      });
    }

    const isSuperAdmin = req.user?.role === 'superadmin';
    const isUserOwnedSport = sport.scope === 'user';
    const isOwner = req.user?._id && sport.createdBy && sport.createdBy._id
      ? String(sport.createdBy._id) === String(req.user._id)
      : req.user?._id && sport.createdBy
        ? String(sport.createdBy) === String(req.user._id)
        : false;

    if (isUserOwnedSport && !isSuperAdmin && !isOwner) {
      return res.status(404).json({
        success: false,
        message: 'Sport not found'
      });
    }

    // If not admin and sport is inactive, return not found
    if (!sport.isActive && req.user?.role !== 'superadmin') {
      return res.status(404).json({
        success: false,
        message: 'Sport not found'
      });
    }

    res.json({
      success: true,
      data: sport
    });
  } catch (error) {
    console.error('Get sport by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update sport
// @route   PUT /api/sports/:id
// @access  Private (Super Admin only)
// export const updateSport = async (req, res) => {
//   try {
//     let sport = await Sport.findById(req.params.id);

//     if (!sport) {
//       return res.status(404).json({
//         success: false,
//         message: 'Sport not found'
//       });
//     }

//     // If name is being changed, check for duplicates
//     if (req.body.name && req.body.name !== sport.name) {
//       const existingSport = await Sport.findOne({
//         name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
//         _id: { $ne: sport._id }
//       });
//       if (existingSport) {
//         return res.status(400).json({
//           success: false,
//           message: 'A sport with this name already exists'
//         });
//       }
//     }

//     sport = await Sport.findByIdAndUpdate(
//       req.params.id,
//       { ...req.body, updatedBy: req.user._id },
//       { new: true, runValidators: true }
//     ).populate('createdBy', 'firstName lastName');

//     res.json({
//       success: true,
//       message: 'Sport updated successfully',
//       data: sport
//     });
//   } catch (error) {
//     console.error('Update sport error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };


// Helper function to clean category data
const cleanCategoryData = (cat) => {
  // Create a completely new object to avoid reference issues
  const cleanCat = {
    name: String(cat.name).trim(),
    isActive: cat.isActive !== undefined ? Boolean(cat.isActive) : true,
    order: cat.order !== undefined ? Number(cat.order) : 0
  };
  
  // Only add optional fields if they have valid values
  if (cat.code && String(cat.code).trim()) {
    cleanCat.code = String(cat.code).trim();
  }
  if (cat.description && String(cat.description).trim()) {
    cleanCat.description = String(cat.description).trim();
  }
  
  // Handle numeric fields - only add if they're actual numbers
  if (cat.minAge !== undefined && cat.minAge !== '' && !isNaN(Number(cat.minAge))) {
    cleanCat.minAge = Number(cat.minAge);
  }
  if (cat.maxAge !== undefined && cat.maxAge !== '' && !isNaN(Number(cat.maxAge))) {
    cleanCat.maxAge = Number(cat.maxAge);
  }
  if (cat.minWeight !== undefined && cat.minWeight !== '' && !isNaN(Number(cat.minWeight))) {
    cleanCat.minWeight = Number(cat.minWeight);
  }
  if (cat.maxWeight !== undefined && cat.maxWeight !== '' && !isNaN(Number(cat.maxWeight))) {
    cleanCat.maxWeight = Number(cat.maxWeight);
  }
  
  // Handle enum fields - only add if they're valid values
  const validGenders = ['male', 'female', 'mixed', 'any'];
  if (cat.gender && String(cat.gender).trim() && validGenders.includes(String(cat.gender).trim())) {
    cleanCat.gender = String(cat.gender).trim();
  }
  
  const validSkillLevels = ['beginner', 'intermediate', 'advanced', 'professional', 'any'];
  if (cat.skillLevel && String(cat.skillLevel).trim() && validSkillLevels.includes(String(cat.skillLevel).trim())) {
    cleanCat.skillLevel = String(cat.skillLevel).trim();
  }
  
  if (cat.weightUnit && String(cat.weightUnit).trim()) {
    cleanCat.weightUnit = String(cat.weightUnit).trim();
  }
  
  // Handle custom fields if present - create new object to avoid references
  if (cat.customFields && typeof cat.customFields === 'object') {
    cleanCat.customFields = JSON.parse(JSON.stringify(cat.customFields));
  }
  
  return cleanCat;
};

// @desc    Create a new sport
// @route   POST /api/sports
// @access  Private (Super Admin only)
export const createSport = async (req, res) => {
  return res.status(403).json({
    success: false,
    code: "SPORT_CREATION_DISABLED_FOR_SUPERADMIN",
    message:
      "Sport creation from Super Admin is disabled. Create sports from role-based modules instead.",
  });
};

// @desc    Update a sport
// @route   PUT /api/sports/:id
// @access  Private (Super Admin only)
export const updateSport = async (req, res) => {
  try {
    const sport = await Sport.findById(req.params.id);

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Sport not found'
      });
    }

    console.log('Updating sport:', sport.name, 'ID:', sport._id);
    console.log('Current categories:', JSON.stringify(sport.categories, null, 2));

    // If name is being changed, check for duplicates
    if (req.body.name && req.body.name !== sport.name) {
      const existingSport = await Sport.findOne({
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
        _id: { $ne: sport._id }
      });
      if (existingSport) {
        return res.status(400).json({
          success: false,
          message: 'A sport with this name already exists'
        });
      }
    }

    // Prepare update data with deep copies
    const updateData = {
      updatedBy: req.user._id
    };

    // Only update fields that are provided in the request
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.icon !== undefined) updateData.icon = req.body.icon;
    if (req.body.image !== undefined) updateData.image = req.body.image;
    if (req.body.isFeatured !== undefined) updateData.isFeatured = req.body.isFeatured;

    // Deep copy complex objects to avoid reference issues
    if (req.body.formats !== undefined) {
      updateData.formats = JSON.parse(JSON.stringify(req.body.formats));
    }
    if (req.body.teamSettings !== undefined) {
      updateData.teamSettings = JSON.parse(JSON.stringify(req.body.teamSettings));
    }
    if (req.body.categorySettings !== undefined) {
      updateData.categorySettings = JSON.parse(JSON.stringify(req.body.categorySettings));
    }
    if (req.body.scoringSystem !== undefined) {
      updateData.scoringSystem = JSON.parse(JSON.stringify(req.body.scoringSystem));
    }
    if (req.body.matchSettings !== undefined) {
      updateData.matchSettings = JSON.parse(JSON.stringify(req.body.matchSettings));
    }
    if (req.body.rules !== undefined) {
      updateData.rules = JSON.parse(JSON.stringify(req.body.rules));
    }
    if (req.body.equipment !== undefined) {
      updateData.equipment = JSON.parse(JSON.stringify(req.body.equipment));
    }
    if (req.body.venueRequirements !== undefined) {
      updateData.venueRequirements = JSON.parse(JSON.stringify(req.body.venueRequirements));
    }

    // Clean categories if they're being updated
    if (req.body.categories !== undefined) {
      const cleanedCategories = req.body.categories.map(cat => cleanCategoryData(cat));
      updateData.categories = cleanedCategories;
      console.log('New categories to update:', JSON.stringify(cleanedCategories, null, 2));
    }

    // Use findByIdAndUpdate with the specific sport ID
    const updatedSport = await Sport.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { 
        new: true, 
        runValidators: true,
        context: 'query'
      }
    ).populate('createdBy', 'firstName lastName');
    logSportAudit({
      sportId: updatedSport._id,
      ownerUser: updatedSport.createdBy || null,
      action: 'UPDATE',
      actorUser: req.user._id,
      actorRole: req.user.role,
      before: toSnapshot(sport),
      after: toSnapshot(updatedSport),
      metadata: { via: 'admin-update' }
    });

    console.log('Sport updated successfully');
    console.log('Updated categories:', JSON.stringify(updatedSport.categories, null, 2));

    // Verify that only this sport was updated
    const otherSports = await Sport.find({ _id: { $ne: req.params.id } }).select('name categories').lean();
    console.log('Other sports check:', otherSports.map(s => ({ 
      name: s.name, 
      categoryCount: s.categories?.length || 0 
    })));

    res.json({
      success: true,
      message: 'Sport updated successfully',
      data: updatedSport
    });
  } catch (error) {
    console.error('Update sport error:', error);
    console.error('Error details:', error.message);
    if (error.errors) {
      console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : undefined
    });
  }
};

// @desc    Get all sports
// @route   GET /api/sports
// @access  Public
export const getSports = async (req, res) => {
  try {
    const { search, format, isActive, page = 1, limit = 12 } = req.query;
    
    const query = {};
    const isSuperAdmin = req.user?.role === 'superadmin';
    const roleNorm = String(req.user?.role || '').toLowerCase();
    const isOrganizer = roleNorm === 'organizer';

    // Organizers: return their saved configurations (separate collection),
    // not the global sport catalog.
    if (!isSuperAdmin && isOrganizer && req.user?._id) {
      const configQuery = { createdBy: req.user._id };

      if (isActive !== undefined) {
        configQuery.isActive = isActive === 'true';
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [configs, total] = await Promise.all([
        SportConfiguration.find(configQuery)
          .populate('sport', 'name slug description icon image')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        SportConfiguration.countDocuments(configQuery),
      ]);

      const data = (configs || []).map((cfg) => ({
        _id: cfg._id,
        sport: cfg?.sport?._id || cfg.sport,
        name: cfg?.sport?.name || '',
        slug: cfg?.sport?.slug || '',
        description: cfg?.sport?.description || '',
        icon: cfg?.icon || cfg?.sport?.icon || '',
        image: cfg?.image || cfg?.sport?.image || '',
        formats: cfg.formats || {},
        teamSettings: cfg.teamSettings || {},
        categorySettings: cfg.categorySettings || {},
        categories: cfg.categories || [],
        scoringSystem: cfg.scoringSystem || {},
        matchSettings: cfg.matchSettings || {},
        rules: cfg.rules || {},
        equipment: cfg.equipment || [],
        venueRequirements: cfg.venueRequirements || {},
        isActive: cfg.isActive !== false,
        createdBy: cfg.createdBy,
        createdAt: cfg.createdAt,
        updatedAt: cfg.updatedAt,
      }));

      return res.json({
        success: true,
        data,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      });
    }

    // Non-organizers: return global catalog (and optionally user-owned sports if those still exist).
    if (!isSuperAdmin) {
      if (req.user?._id) {
        query.$or = [
          { scope: 'system' },
          { scope: { $exists: false } },
          { scope: 'user', createdBy: req.user._id }
        ];
      } else {
        query.$or = [
          { scope: 'system' },
          { scope: { $exists: false } }
        ];
      }
    }

    if (search) {
      const searchCond = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      };
      const accessKeys = Object.keys(query);
      if (accessKeys.length === 0) {
        Object.assign(query, searchCond);
      } else {
        const access = { ...query };
        for (const k of accessKeys) delete query[k];
        query.$and = [access, searchCond];
      }
    }
    
    if (format) {
      query[`formats.${format}.enabled`] = true;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const sports = await Sport.find(query)
      .populate('createdBy', 'firstName lastName')
      // Newest → oldest (last added comes first).
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Use lean to get plain objects
    
    const total = await Sport.countDocuments(query);
    
    // Log each sport's categories for debugging
    sports.forEach(sport => {
      console.log(`Sport: ${sport.name}, Categories: ${sport.categories?.length || 0}`);
    });
    
    res.json({
      success: true,
      data: sports,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Get sports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
// @desc    Delete sport
// @route   DELETE /api/sports/:id
// @access  Private (Super Admin only)
export const deleteSport = async (req, res) => {
  try {
    const sport = await Sport.findById(req.params.id);

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Sport not found'
      });
    }

    // Check if sport is used in any events
    const eventsUsingSport = await Event.countDocuments({ sport: sport._id });
    if (eventsUsingSport > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete sport. It is being used in ${eventsUsingSport} event(s). Please deactivate instead.`
      });
    }

    const before = toSnapshot(sport);
    await Sport.findByIdAndDelete(req.params.id);
    logSportAudit({
      sportId: sport._id,
      ownerUser: sport.createdBy || null,
      action: 'DELETE',
      actorUser: req.user._id,
      actorRole: req.user.role,
      before,
      after: null,
      metadata: { via: 'admin-delete' }
    });

    res.json({
      success: true,
      message: 'Sport deleted successfully'
    });
  } catch (error) {
    console.error('Delete sport error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Toggle sport active status
// @route   PATCH /api/sports/:id/toggle-status
// @access  Private (Super Admin only)
export const toggleSportStatus = async (req, res) => {
  try {
    const sport = await Sport.findById(req.params.id);

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Sport not found'
      });
    }

    const before = toSnapshot(sport);
    sport.isActive = !sport.isActive;
    sport.updatedBy = req.user._id;
    await sport.save();
    logSportAudit({
      sportId: sport._id,
      ownerUser: sport.createdBy || null,
      action: 'STATUS_CHANGE',
      actorUser: req.user._id,
      actorRole: req.user.role,
      before,
      after: toSnapshot(sport),
      metadata: { via: 'admin-toggle-status', isActive: sport.isActive }
    });

    res.json({
      success: true,
      message: `Sport ${sport.isActive ? 'activated' : 'deactivated'} successfully`,
      data: sport
    });
  } catch (error) {
    console.error('Toggle sport status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Toggle sport featured status
// @route   PATCH /api/sports/:id/toggle-featured
// @access  Private (Super Admin only)
export const toggleFeaturedStatus = async (req, res) => {
  try {
    const sport = await Sport.findById(req.params.id);

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Sport not found'
      });
    }

    const before = toSnapshot(sport);
    sport.isFeatured = !sport.isFeatured;
    sport.updatedBy = req.user._id;
    await sport.save();
    logSportAudit({
      sportId: sport._id,
      ownerUser: sport.createdBy || null,
      action: 'STATUS_CHANGE',
      actorUser: req.user._id,
      actorRole: req.user.role,
      before,
      after: toSnapshot(sport),
      metadata: { via: 'admin-toggle-featured', isFeatured: sport.isFeatured }
    });

    res.json({
      success: true,
      message: `Sport ${sport.isFeatured ? 'marked as featured' : 'removed from featured'} successfully`,
      data: sport
    });
  } catch (error) {
    console.error('Toggle featured status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get sports for dropdown/selection (simplified)
// @route   GET /api/sports/list
// @access  Public
export const getSportsList = async (req, res) => {
  try {
    const { format, q } = req.query;
    const query = { isActive: true };

    // CentrePitch global rule: sports are seeded/managed by Super Admin (system catalog).
    // Everyone can search/select from the system catalog.
    query.$or = [{ scope: 'system' }, { scope: { $exists: false } }];

    const search = q != null ? String(q).trim() : '';
    if (search) {
      query.$and = [
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { slug: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }

    if (format) {
      query[`formats.${format}.enabled`] = true;
    }

    const sports = await Sport.find(query)
      .select('name slug description icon formats categories')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: sports
    });
  } catch (error) {
    console.error('Get sports list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create a sport from public (coach/academy registration etc.)
// @route   POST /api/sports/public
// @access  Public
export const createPublicSport = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const {
      sportId,
      name,
      description,
      icon,
      image,
      formats,
      teamSettings,
      categories,
      categorySettings,
      scoringSystem,
      matchSettings,
      rules,
      equipment,
      venueRequirements,
      isFeatured
    } = req.body;

    if ((!sportId || !String(sportId).trim()) && (!name || !name.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Sport name is required'
      });
    }

    let systemSport = null;
    const sportIdStr = String(sportId || '').trim();
    if (sportIdStr && mongoose.Types.ObjectId.isValid(sportIdStr)) {
      systemSport = await Sport.findOne({
        _id: sportIdStr,
        scope: 'system',
        isActive: true,
      }).select('_id name slug description icon image');
    }

    if (!systemSport) {
      const trimmedName = String(name || '').trim();
      if (trimmedName) {
        systemSport = await Sport.findOne({
          scope: 'system',
          isActive: true,
          name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
        }).select('_id name slug description icon image');
      }
    }

    if (!systemSport) {
      return res.status(400).json({
        success: false,
        message: 'Sport not found in catalog. Add it first under Profile → Organization or ask admin to add it.'
      });
    }

    const cleanedCategories = (categories || []).map((cat) => cleanCategoryData(cat));

    const upsert = await SportConfiguration.findOneAndUpdate(
      { createdBy: req.user._id, sport: systemSport._id },
      {
        $set: {
          icon: typeof icon === 'string' ? icon : '',
          image: typeof image === 'string' ? image : '',
          formats: JSON.parse(JSON.stringify(formats || {})),
          teamSettings: JSON.parse(JSON.stringify(teamSettings || {})),
          categorySettings: JSON.parse(JSON.stringify(categorySettings || {})),
          categories: cleanedCategories,
          scoringSystem: JSON.parse(JSON.stringify(scoringSystem || {})),
          matchSettings: JSON.parse(JSON.stringify(matchSettings || {})),
          rules: JSON.parse(JSON.stringify(rules || {})),
          equipment: JSON.parse(JSON.stringify(equipment || [])),
          venueRequirements: JSON.parse(JSON.stringify(venueRequirements || {})),
          isActive: true,
        },
      },
      { upsert: true, new: true }
    ).lean();

    logSportAudit({
      // Reuse existing audit trail schema enums.
      // This row is an organizer-owned configuration, so treat it like a user sport entry.
      sportModel: 'UserSport',
      sportId: upsert._id,
      ownerUser: req.user._id,
      action: 'UPDATE',
      actorUser: req.user._id,
      actorRole: req.user.role,
      before: null,
      after: upsert,
      metadata: { via: 'public-config-upsert', sportId: systemSport._id }
    });

    res.status(201).json({
      success: true,
      message: 'Sport created successfully',
      data: {
        _id: upsert._id,
        sport: systemSport._id,
        name: systemSport.name,
        slug: systemSport.slug,
        description: systemSport.description,
        icon: upsert.icon || systemSport.icon,
        image: upsert.image || systemSport.image,
        formats: upsert.formats || {},
        teamSettings: upsert.teamSettings || {},
        categorySettings: upsert.categorySettings || {},
        categories: upsert.categories || [],
        scoringSystem: upsert.scoringSystem || {},
        matchSettings: upsert.matchSettings || {},
        rules: upsert.rules || {},
        equipment: upsert.equipment || [],
        venueRequirements: upsert.venueRequirements || {},
        isActive: upsert.isActive !== false,
        createdBy: upsert.createdBy,
        createdAt: upsert.createdAt,
        updatedAt: upsert.updatedAt,
      }
    });
  } catch (error) {
    console.error('Public create sport error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update own user-created sport
// @route   PUT /api/sports/public/:id
// @access  Private
export const updateOwnPublicSport = async (req, res) => {
  try {
    const {
      name,
      description,
      icon,
      image,
      formats,
      teamSettings,
      categories,
      categorySettings,
      scoringSystem,
      matchSettings,
      rules,
      equipment,
      venueRequirements,
      isFeatured
    } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Sport name is required'
      });
    }

    const sport = await SportConfiguration.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Sport not found'
      });
    }

    const before = sport.toObject ? sport.toObject({ depopulate: true }) : sport;
    const cleanedCategories = (categories || []).map((cat) => cleanCategoryData(cat));

    if (typeof icon === 'string') sport.icon = icon;
    if (typeof image === 'string') sport.image = image;
    sport.formats = JSON.parse(JSON.stringify(formats || sport.formats || {}));
    sport.teamSettings = JSON.parse(JSON.stringify(teamSettings || sport.teamSettings || {}));
    sport.categorySettings = JSON.parse(JSON.stringify(categorySettings || sport.categorySettings || {}));
    sport.categories = cleanedCategories;
    sport.scoringSystem = JSON.parse(JSON.stringify(scoringSystem || sport.scoringSystem || {}));
    sport.matchSettings = JSON.parse(JSON.stringify(matchSettings || sport.matchSettings || {}));
    sport.rules = JSON.parse(JSON.stringify(rules || sport.rules || {}));
    sport.equipment = JSON.parse(JSON.stringify(equipment || sport.equipment || []));
    sport.venueRequirements = JSON.parse(
      JSON.stringify(venueRequirements || sport.venueRequirements || {})
    );
    await sport.save();

    logSportAudit({
      sportModel: 'UserSport',
      sportId: sport._id,
      ownerUser: req.user._id,
      action: 'UPDATE',
      actorUser: req.user._id,
      actorRole: req.user.role,
      before,
      after: sport.toObject ? sport.toObject({ depopulate: true }) : sport,
      metadata: { via: 'public-config-update' }
    });

    const populated = await SportConfiguration.findById(sport._id)
      .populate('sport', 'name slug description icon image')
      .lean();

    return res.json({
      success: true,
      message: 'Sport updated successfully',
      data: {
        _id: populated._id,
        sport: populated?.sport?._id || populated.sport,
        name: populated?.sport?.name || '',
        slug: populated?.sport?.slug || '',
        description: populated?.sport?.description || '',
        icon: populated?.icon || populated?.sport?.icon || '',
        image: populated?.image || populated?.sport?.image || '',
        formats: populated.formats || {},
        teamSettings: populated.teamSettings || {},
        categorySettings: populated.categorySettings || {},
        categories: populated.categories || [],
        scoringSystem: populated.scoringSystem || {},
        matchSettings: populated.matchSettings || {},
        rules: populated.rules || {},
        equipment: populated.equipment || [],
        venueRequirements: populated.venueRequirements || {},
        isActive: populated.isActive !== false,
        createdBy: populated.createdBy,
        createdAt: populated.createdAt,
        updatedAt: populated.updatedAt,
      }
    });
  } catch (error) {
    console.error('Update own public sport error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete own user-created sport
// @route   DELETE /api/sports/public/:id
// @access  Private
export const deleteOwnPublicSport = async (req, res) => {
  try {
    const sport = await SportConfiguration.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Sport not found'
      });
    }

    const before = toSnapshot(sport);
    await SportConfiguration.findByIdAndDelete(sport._id);

    logSportAudit({
      sportModel: 'UserSport',
      sportId: sport._id,
      ownerUser: req.user._id,
      action: 'DELETE',
      actorUser: req.user._id,
      actorRole: req.user.role,
      before,
      after: null,
      metadata: { via: 'public-config-delete' }
    });

    return res.json({
      success: true,
      message: 'Sport deleted successfully'
    });
  } catch (error) {
    console.error('Delete own public sport error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Team member role/status labels for academy & coach UIs (from Sport.teamSettings or defaults)
// @route   GET /api/sports/member-ui-options?sportId= | &name=
// @access  Optional auth (public list uses catalog Sport)
export const getMemberUiOptions = async (req, res) => {
  try {
    const sportId = req.query.sportId != null ? String(req.query.sportId).trim() : '';
    const name = req.query.name != null ? String(req.query.name).trim() : '';
    let sport = null;
    if (sportId && mongoose.Types.ObjectId.isValid(sportId)) {
      sport = await Sport.findById(sportId).select('teamSettings name').lean();
    } else if (name) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      sport = await Sport.findOne({ name: new RegExp(`^${esc}$`, 'i') })
        .select('teamSettings name')
        .lean();
    }
    const data = buildMemberUiOptionsFromSport(sport || {});
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get member UI options error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get sport statistics
// @route   GET /api/sports/stats
// @access  Private (Super Admin only)
export const getSportsStats = async (req, res) => {
  try {
    const totalSports = await Sport.countDocuments();
    const activeSports = await Sport.countDocuments({ isActive: true });
    const featuredSports = await Sport.countDocuments({ isFeatured: true });
    
    const formatCounts = await Sport.aggregate([
      {
        $group: {
          _id: null,
          individual: { $sum: { $cond: ['$formats.individual.enabled', 1, 0] } },
          doubles: { $sum: { $cond: ['$formats.doubles.enabled', 1, 0] } },
          team: { $sum: { $cond: ['$formats.team.enabled', 1, 0] } }
        }
      }
    ]);

    const popularSports = await Sport.find({ isActive: true })
      .sort({ 'stats.eventsCount': -1 })
      .limit(5)
      .select('name slug stats.eventsCount stats.totalParticipants');

    res.json({
      success: true,
      data: {
        total: totalSports,
        active: activeSports,
        inactive: totalSports - activeSports,
        featured: featuredSports,
        byFormat: formatCounts[0] || { individual: 0, doubles: 0, team: 0 },
        popularSports
      }
    });
  } catch (error) {
    console.error('Get sports stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};