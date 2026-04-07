import mongoose from "mongoose";
import SportsAcademy from "../../models/SportsAcademy.js";
import Coach from "../../models/Coach.js";
import Court from "../../models/Court.js";
import User from "../../models/User.js";
import KYC from "../../models/Kyc.js";
import Sport from "../../models/Sport.js";
import UserSport from "../../models/UserSport.js";
import RoleSportAuditTrail from "../../models/RoleSportAuditTrail.js";
import { uploadToR2 } from "../../services/cloudflareService.js";
import sendEmail, { emailTemplates } from "../../utils/sendEmail.js";
import sendPhoneOtp from "../../utils/sendPhoneOtp.js";
import {
  DUPLICATE_EMAIL_MESSAGE,
  DUPLICATE_PHONE_MESSAGE,
} from "../../constants/contactErrors.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();
const normalizePhone = (phone = "") => String(phone || "").trim();
const isNotExpired = (value) => value && new Date(value).getTime() > Date.now();

/** Same rules as public catalog — detail page must only load these academies */
const ACADEMY_PUBLIC_VISIBILITY_OR = [
  { status: "APPROVED" },
  {
    status: "PENDING",
    "metadata.createdVia": "subscription_unlock",
  },
  {
    status: "PENDING",
    adminUser: { $exists: true, $ne: null },
    "metadata.pendingAdminEmail": { $exists: false },
  },
];

export const getPublicAcademies = async (req, res) => {
  try {
    const { city, sport, search, page = 1, limit = 10 } = req.query;

    const query = { isActive: true };
    const searchTrim = search != null ? String(search).trim() : "";
    if (searchTrim) {
      query.$and = [
        { $or: ACADEMY_PUBLIC_VISIBILITY_OR },
        {
          $or: [
            { name: { $regex: searchTrim, $options: "i" } },
            { description: { $regex: searchTrim, $options: "i" } },
          ],
        },
      ];
    } else {
      query.$or = ACADEMY_PUBLIC_VISIBILITY_OR;
    }

    if (city) {
      query["address.city"] = { $regex: city, $options: "i" };
    }

    if (sport) {
      query.sportsOffered = sport;
    }

    const academies = await SportsAcademy.find(query)
      .select("-metadata -kycDocuments")
      .populate("adminUser", "firstName lastName")
      .populate("sportsOffered", "name slug isActive")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ isFeatured: -1, createdAt: -1 });

    const academyIds = academies.map((a) => a?._id).filter(Boolean);
    const courtCounts = academyIds.length
      ? await Court.aggregate([
          {
            $match: {
              academy: { $in: academyIds },
              isActive: true,
              status: "APPROVED",
            },
          },
          { $group: { _id: "$academy", count: { $sum: 1 } } },
        ])
      : [];
    const courtCountByAcademyId = new Map(
      courtCounts.map((row) => [String(row?._id || ""), Number(row?.count || 0)])
    );
    const academiesWithCounts = academies.map((academy) => {
      const obj = academy.toObject();
      obj.totalCourts = courtCountByAcademyId.get(String(academy?._id || "")) || 0;
      return obj;
    });

    const count = await SportsAcademy.countDocuments(query);

    res.status(200).json({
      success: true,
      count: academiesWithCounts.length,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: academiesWithCounts,
    });
  } catch (error) {
    console.error("Get public academies error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching academies",
      error: error.message,
    });
  }
};

/**
 * @desc    Single academy for public profile (same visibility as GET /academies/public)
 * @route   GET /api/academies/public/:id
 * @access  Public
 */
export const getPublicAcademyById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid academy id",
      });
    }

    const academy = await SportsAcademy.findOne({
      _id: id,
      isActive: true,
      $or: ACADEMY_PUBLIC_VISIBILITY_OR,
    })
      .populate("adminUser", "firstName lastName email")
      .populate("courts", "name sportType sportTypes status pricing")
      .populate("courts.sportType", "name slug")
      .populate("courts.sportTypes", "name slug")
      .populate("sportsOffered", "name slug isActive");

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    const [coaches, kyc] = await Promise.all([
      Coach.find({
        "academies.academy": academy._id,
        "academies.status": { $in: ["APPROVED", "ACTIVE"] },
        status: "APPROVED",
      }).select("firstName lastName email specialization status profilePhoto phone"),
      KYC.findOne({
        entityType: "ACADEMY",
        entityId: academy._id,
      }).select("overallStatus submittedAt documents"),
    ]);

    const academyObj = academy.toObject();
    academyObj.coaches = coaches;
    academyObj.totalCourts = Array.isArray(academyObj.courts) ? academyObj.courts.length : 0;
    academyObj.totalCoaches = Array.isArray(coaches) ? coaches.length : 0;
    academyObj.kyc = kyc || null;

    academyObj.kycDocuments = (kyc?.documents || []).map((doc) => ({
      type: String(doc.documentType || "").toLowerCase(),
      name: doc.documentName || doc.documentType || "Document",
      url: doc.documentUrl,
      fileUrl: doc.documentUrl,
      verificationStatus: doc.verificationStatus || "PENDING",
      uploadedAt: doc.uploadedAt || null,
    }));

    res.status(200).json({
      success: true,
      data: academyObj,
    });
  } catch (error) {
    console.error("Get public academy by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching academy",
      error: error.message,
    });
  }
};

export const getPendingAcademies = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

    // Show only academies that actually submitted KYC documents
    let query = {
      status: "PENDING",
      kycStatus: "PENDING",
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
      ];
    }

    const totalRecords = await SportsAcademy.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limitNum);

    const academies = await SportsAcademy.find(query)
      .select("-metadata")
      .populate("sportsOffered", "name slug isActive")
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: academies.length,
      totalRecords,
      totalPages,
      currentPage: pageNum,
      perPage: limitNum,
      data: academies,
    });
  } catch (error) {
    console.error("Get pending academies error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending academies",
      error: error.message,
    });
  }
};

export const getAllAcademiesAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10)));

    const query = {};

    if (status) {
      const statuses = String(status)
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);

      if (statuses.length > 0) {
        query.status = { $in: statuses };
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
      ];
    }

    const totalRecords = await SportsAcademy.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limitNum);

    const academies = await SportsAcademy.find(query)
      .select("-metadata -kycDocuments")
      .populate("sportsOffered", "name slug isActive")
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: academies.length,
      totalRecords,
      totalPages,
      currentPage: pageNum,
      perPage: limitNum,
      data: academies,
    });
  } catch (error) {
    console.error("Get all academies admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching academies",
      error: error.message,
    });
  }
};

export const getAcademyById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid academy id",
      });
    }

    const academy = await SportsAcademy.findById(id)
      .populate("adminUser", "firstName lastName email")
      .populate("courts", "name sportType status pricing")
      .populate("courts.sportType", "name slug")
      .populate("sportsOffered", "name slug isActive");

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    const [coaches, kyc] = await Promise.all([
      Coach.find({
        "academies.academy": academy._id,
        "academies.status": { $in: ["APPROVED", "ACTIVE"] },
        status: "APPROVED",
      }).select("firstName lastName email specialization status profilePhoto phone"),
      KYC.findOne({
        entityType: "ACADEMY",
        entityId: academy._id,
      }).select("overallStatus submittedAt documents")
    ]);

    const academyObj = academy.toObject();
    academyObj.coaches = coaches;
    academyObj.totalCourts = Array.isArray(academyObj.courts) ? academyObj.courts.length : 0;
    academyObj.totalCoaches = Array.isArray(coaches) ? coaches.length : 0;
    academyObj.kyc = kyc || null;

    // Backward-compatible shape expected by admin academy details UI.
    academyObj.kycDocuments = (kyc?.documents || []).map((doc) => ({
      type: String(doc.documentType || "").toLowerCase(),
      name: doc.documentName || doc.documentType || "Document",
      url: doc.documentUrl,
      fileUrl: doc.documentUrl,
      verificationStatus: doc.verificationStatus || "PENDING",
      uploadedAt: doc.uploadedAt || null,
    }));

    res.status(200).json({
      success: true,
      data: academyObj,
    });
  } catch (error) {
    console.error("Get academy by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching academy",
      error: error.message,
    });
  }
};

/**
 * @desc    Get my academy profile (for logged-in academy admin)
 * @route   GET /api/academies/my
 * @access  Private (academyadmin / superadmin)
 */
export const getMyAcademy = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id })
      .populate("adminUser", "firstName lastName email phone")
      .populate("courts", "name sportType sportTypes status")
      .populate("courts.sportType", "name slug")
      .populate("courts.sportTypes", "name slug")
      .populate("sportsOffered", "name slug isActive");

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "No academy found for your account",
      });
    }

    const [coaches, kyc] = await Promise.all([
      Coach.find({
        "academies.academy": academy._id,
        "academies.status": { $in: ["APPROVED", "ACTIVE"] },
        status: "APPROVED",
      }).select("firstName lastName email specialization status profilePhoto phone"),
      KYC.findOne({
        entityType: "ACADEMY",
        entityId: academy._id,
      }).select(
        "overallStatus documents.documentType documents.documentName documents.documentUrl documents.verificationStatus documents.uploadedAt submittedAt"
      ),
    ]);

    const academyObj = academy.toObject();
    academyObj.coaches = coaches;

    res.status(200).json({
      success: true,
      data: {
        academy: academyObj,
        kyc: kyc || null,
      },
    });
  } catch (error) {
    console.error("Get my academy error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching your academy profile",
      error: error.message,
    });
  }
};

/**
 * @desc    Update academy profile
 * @route   PUT /api/academies/:id
 * @access  Private (academyadmin for own academy / superadmin for any)
 */
export const updateAcademy = async (req, res) => {
  try {
    const academy = await SportsAcademy.findById(req.params.id);

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    // Academy admin can only update their own academy
    if (
      req.user.role === "academyadmin" &&
      academy.adminUser?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own academy",
      });
    }

    // Fields that academy admin can update
    const {
      name,
      email,
      description,
      phone,
      website,
      address,
      sportsOffered,
      facilities,
      socialMedia,
      establishedYear,
    } = req.body;

    const incomingEmail = email !== undefined && email !== null ? normalizeEmail(email) : undefined;
    const incomingPhone = phone !== undefined && phone !== null ? normalizePhone(phone) : undefined;
    const adminUser = academy.adminUser ? await User.findById(academy.adminUser).select("email phone").lean() : null;

    if (incomingEmail !== undefined) {
      if (!incomingEmail) {
        return res.status(400).json({
          success: false,
          message: "Academy email is required",
        });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(incomingEmail)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid academy email",
        });
      }
      if (adminUser?.email && incomingEmail === normalizeEmail(adminUser.email)) {
        return res.status(400).json({
          success: false,
          message: "Academy email and admin email must be different",
        });
      }
      if (incomingEmail !== normalizeEmail(academy.email)) {
        const [academyEmailExists, userEmailExists, coachEmailExists] = await Promise.all([
          SportsAcademy.findOne({ email: incomingEmail, _id: { $ne: academy._id } }).select("_id").lean(),
          User.findOne({ email: incomingEmail }).select("_id").lean(),
          Coach.findOne({ email: incomingEmail }).select("_id").lean(),
        ]);
        if (academyEmailExists || userEmailExists || coachEmailExists) {
          return res.status(409).json({
            success: false,
            message: DUPLICATE_EMAIL_MESSAGE,
          });
        }
      }
    }

    if (incomingPhone !== undefined) {
      if (!incomingPhone) {
        return res.status(400).json({
          success: false,
          message: "Academy phone number is required",
        });
      }
      if (!/^[6-9]\d{9}$/.test(incomingPhone.replace(/\D/g, ""))) {
        return res.status(400).json({
          success: false,
          message: "Invalid academy phone number (10 digits, starts with 6-9)",
        });
      }
      if (adminUser?.phone && incomingPhone === normalizePhone(adminUser.phone)) {
        return res.status(400).json({
          success: false,
          message: "Academy phone and admin phone must be different",
        });
      }
      if (incomingPhone !== normalizePhone(academy.phone)) {
        const [academyPhoneExists, userPhoneExists, coachPhoneExists] = await Promise.all([
          SportsAcademy.findOne({ phone: incomingPhone, _id: { $ne: academy._id } }).select("_id").lean(),
          User.findOne({ phone: incomingPhone }).select("_id").lean(),
          Coach.findOne({ phone: incomingPhone }).select("_id").lean(),
        ]);
        if (academyPhoneExists || userPhoneExists || coachPhoneExists) {
          return res.status(409).json({
            success: false,
            message: DUPLICATE_PHONE_MESSAGE,
          });
        }
      }
    }

    if (name) academy.name = name;
    if (incomingEmail !== undefined) {
      const previousEmail = normalizeEmail(academy.email);
      academy.email = incomingEmail;
      if (incomingEmail !== previousEmail) {
        academy.isEmailVerified = false;
        academy.emailOtp = null;
        academy.emailOtpExpire = null;
      }
    }
    if (description) academy.description = description;
    if (incomingPhone !== undefined) {
      const previousPhone = normalizePhone(academy.phone);
      academy.phone = incomingPhone;
      if (incomingPhone !== previousPhone) {
        academy.isPhoneVerified = false;
        academy.phoneOtp = null;
        academy.phoneOtpExpire = null;
      }
    }
    if (website !== undefined) academy.website = website;
    if (address) {
      const parsedAddress = typeof address === "string" ? JSON.parse(address) : address;
      academy.address = { ...academy.address.toObject?.() || academy.address, ...parsedAddress };
    }
    if (sportsOffered) {
      academy.sportsOffered = typeof sportsOffered === "string" ? JSON.parse(sportsOffered) : sportsOffered;
    }
    if (facilities) {
      academy.facilities = typeof facilities === "string" ? JSON.parse(facilities) : facilities;
    }
    if (socialMedia) {
      const parsedSocial = typeof socialMedia === "string" ? JSON.parse(socialMedia) : socialMedia;
      academy.socialMedia = { ...academy.socialMedia?.toObject?.() || academy.socialMedia, ...parsedSocial };
    }
    if (establishedYear) academy.establishedYear = parseInt(establishedYear);

    await academy.save();

    res.status(200).json({
      success: true,
      message: "Academy updated successfully",
      data: academy,
    });
  } catch (error) {
    console.error("Update academy error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating academy",
      error: error.message,
    });
  }
};

/**
 * @desc    Delete academy (super admin only)
 * @route   DELETE /api/academies/:id
 * @access  Private/SuperAdmin
 */
export const deleteAcademy = async (req, res) => {
  try {
    const academy = await SportsAcademy.findById(req.params.id);

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    // Soft delete - deactivate instead of removing
    academy.isActive = false;
    academy.status = "SUSPENDED";
    await academy.save();

    res.status(200).json({
      success: true,
      message: "Academy deleted successfully",
    });
  } catch (error) {
    console.error("Delete academy error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting academy",
      error: error.message,
    });
  }
};

/**
 * @desc    Update academy logo
 * @route   PUT /api/academies/:id/logo
 * @access  Private (academyadmin for own academy / superadmin for any)
 */
export const updateAcademyLogo = async (req, res) => {
  try {
    const academy = await SportsAcademy.findById(req.params.id);

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    // Academy admin can only update their own academy logo
    if (
      req.user.role === "academyadmin" &&
      academy.adminUser?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own academy logo",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Logo image file is required",
      });
    }

    const result = await uploadToR2(req.file, "academy-logos");
    academy.logo = result.url;
    await academy.save();

    res.status(200).json({
      success: true,
      message: "Academy logo updated successfully",
      data: {
        logo: academy.logo,
      },
    });
  } catch (error) {
    console.error("Update academy logo error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating academy logo",
      error: error.message,
    });
  }
};

/**
 * @desc    Get my academy's sports (for court creation)
 * @route   GET /api/academies/my/sports
 * @access  Private (academyadmin)
 */
export const getMyAcademySports = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id })
      .populate("sportsOffered", "name slug isActive");

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "No academy found for your account",
      });
    }

    // Filter to only active sports
    const activeSports = (academy.sportsOffered || []).filter(sport => sport && sport.isActive);

    res.status(200).json({
      success: true,
      count: activeSports.length,
      data: activeSports,
    });
  } catch (error) {
    console.error("Get my academy sports error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching academy sports",
      error: error.message,
    });
  }
};

/**
 * @desc    Update my academy's sports
 * @route   PUT /api/academies/my/sports
 * @access  Private (academyadmin)
 */
export const updateMyAcademySports = async (req, res) => {
  try {
    const { sportsOffered } = req.body;

    if (!sportsOffered || !Array.isArray(sportsOffered)) {
      return res.status(400).json({
        success: false,
        message: "sportsOffered array is required",
      });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "No academy found for your account",
      });
    }

    // Verify sport IDs exist in the Super Admin catalog (Sport)
    const validSports = await Sport.find({
      _id: { $in: sportsOffered },
      isActive: true,
    }).select("_id");

    if (validSports.length !== sportsOffered.length) {
      return res.status(400).json({
        success: false,
        message: "Some sport IDs are invalid or inactive",
      });
    }

    const beforeSportsOffered = Array.isArray(academy.sportsOffered)
      ? academy.sportsOffered.map((id) => String(id))
      : [];

    academy.sportsOffered = sportsOffered;
    await academy.save();

    Promise.resolve()
      .then(async () => {
        await RoleSportAuditTrail.create({
          entityType: "ACADEMY",
          entityId: academy._id,
          field: "sportsOffered",
          action: "SET",
          actorUser: req.user._id,
          actorRole: req.user.role,
          before: beforeSportsOffered,
          after: Array.isArray(sportsOffered) ? sportsOffered.map((id) => String(id)) : [],
          metadata: {
            via: "updateMyAcademySports",
            academyAdminUser: String(req.user._id),
          },
        });
      })
      .catch((error) => {
        console.error("Academy sports audit log failed:", error.message);
      });

    // Return populated sports
    await academy.populate("sportsOffered", "name slug isActive");

    res.status(200).json({
      success: true,
      message: "Academy sports updated successfully",
      data: academy.sportsOffered,
    });
  } catch (error) {
    console.error("Update my academy sports error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating academy sports",
      error: error.message,
    });
  }
};

export const sendAcademyEmailOTP = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found for your account",
      });
    }

    const academyEmail = normalizeEmail(academy.email);
    if (!academyEmail) {
      return res.status(400).json({
        success: false,
        message: "Academy email is not configured",
      });
    }

    if (!academy.emailOtp || !isNotExpired(academy.emailOtpExpire)) {
      academy.emailOtp = generateOtp();
      academy.emailOtpExpire = Date.now() + OTP_EXPIRY_MS;
      await academy.save();
    }

    const adminName = req.user?.firstName || academy.name || "Academy";
    const template = emailTemplates.otpVerification(academy.emailOtp, adminName);
    await sendEmail({
      to: academyEmail,
      subject: template.subject,
      html: template.html,
    });

    return res.status(200).json({
      success: true,
      message: "Academy email OTP sent successfully",
    });
  } catch (error) {
    console.error("Send academy email OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending academy email OTP",
      error: error.message,
    });
  }
};

export const verifyAcademyEmailOTP = async (req, res) => {
  try {
    const otp = String(req.body?.otp || "").trim();
    if (!otp || otp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 6-digit OTP",
      });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found for your account",
      });
    }

    if (!(String(academy.emailOtp || "").trim() === otp && isNotExpired(academy.emailOtpExpire))) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    academy.isEmailVerified = true;
    academy.emailOtp = null;
    academy.emailOtpExpire = null;

    if (academy.phone && !academy.isPhoneVerified) {
      academy.phoneOtp = generateOtp();
      academy.phoneOtpExpire = Date.now() + OTP_EXPIRY_MS;
      const smsResult = await sendPhoneOtp({ phone: academy.phone, otp: academy.phoneOtp });
      if (!smsResult.success) {
        return res.status(500).json({
          success: false,
          message: "Email verified, but failed to send academy phone OTP",
        });
      }
    }

    await academy.save();

    return res.status(200).json({
      success: true,
      message: academy.isPhoneVerified
        ? "Academy email and phone are verified"
        : "Academy email verified. Academy phone verification is optional.",
      data: {
        academyId: academy._id,
        isEmailVerified: academy.isEmailVerified,
        isPhoneVerified: academy.isPhoneVerified,
      },
    });
  } catch (error) {
    console.error("Verify academy email OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Error verifying academy email OTP",
      error: error.message,
    });
  }
};

export const sendAcademyPhoneOTP = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found for your account",
      });
    }

    if (!academy.phone) {
      return res.status(400).json({
        success: false,
        message: "Academy phone is not configured",
      });
    }

    if (!academy.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Please verify academy email first, then request phone OTP.",
      });
    }

    academy.phoneOtp = generateOtp();
    academy.phoneOtpExpire = Date.now() + OTP_EXPIRY_MS;
    await academy.save();

    const smsResult = await sendPhoneOtp({ phone: academy.phone, otp: academy.phoneOtp });
    if (!smsResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send academy phone OTP",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Academy phone OTP sent successfully",
    });
  } catch (error) {
    console.error("Send academy phone OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending academy phone OTP",
      error: error.message,
    });
  }
};

export const verifyAcademyPhoneOTP = async (req, res) => {
  try {
    const otp = String(req.body?.otp || "").trim();
    if (!otp || otp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 6-digit OTP",
      });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found for your account",
      });
    }

    if (!(String(academy.phoneOtp || "").trim() === otp && isNotExpired(academy.phoneOtpExpire))) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired phone OTP",
      });
    }

    academy.isPhoneVerified = true;
    academy.phoneOtp = null;
    academy.phoneOtpExpire = null;
    await academy.save();

    return res.status(200).json({
      success: true,
      message: "Academy phone verified successfully",
      data: {
        academyId: academy._id,
        isEmailVerified: academy.isEmailVerified,
        isPhoneVerified: academy.isPhoneVerified,
      },
    });
  } catch (error) {
    console.error("Verify academy phone OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Error verifying academy phone OTP",
      error: error.message,
    });
  }
};

