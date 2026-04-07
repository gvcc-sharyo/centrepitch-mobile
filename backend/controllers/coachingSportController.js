import UserSport from "../models/UserSport.js";
import SportAuditTrail from "../models/SportAuditTrail.js";

const coerceSportName = (value = "") => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const candidate = value.name ?? value.label ?? value.title ?? value.value ?? "";
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate);
    }
  }
  return "";
};

const normalizeSportName = (value = "") =>
  coerceSportName(value)
    .trim()
    .replace(/\s+/g, " ");

const toSlug = (value = "") =>
  normalizeSportName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const toObjectSnapshot = (doc) => {
  if (!doc) return null;
  if (typeof doc.toObject === "function") {
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

const logCoachingSportAudit = ({
  sportId,
  ownerUser = null,
  action,
  actorUser,
  actorRole = null,
  before = null,
  after = null,
  metadata = {},
} = {}) => {
  if (!sportId || !actorUser || !action) return;
  runInBackground("Coaching sport audit log", async () => {
    await SportAuditTrail.create({
      sportModel: "UserSport",
      sportId,
      ownerUser,
      action,
      actorUser,
      actorRole,
      before,
      after,
      metadata,
    });
  });
};

// @desc    Get coaching sports list for dropdowns (simplified)
// @route   GET /api/coaching-sports/list
// @access  Public
export const getCoachingSportsList = async (req, res) => {
  try {
    // Personal catalog only: each user sees sports they created (shared across their unlocked roles).
    // Unauthenticated callers get an empty list (no global master catalog).
    if (!req.user?._id) {
      return res.json({ success: true, data: [] });
    }

    const sports = await UserSport.find({
      isActive: true,
      scope: "user",
      createdBy: req.user._id,
    })
      .select("name slug scope createdBy")
      .sort({ name: 1 });

    res.json({
      success: true,
      data: sports,
    });
  } catch (error) {
    console.error("Get coaching sports list error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Create a coaching sport from public (coach/academy registration)
// @route   POST /api/coaching-sports/public
// @access  Public
export const createPublicCoachingSport = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { name } = req.body;
    const normalizedName = normalizeSportName(name);
    const candidateSlug = toSlug(normalizedName);

    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        message: "Sport name is required",
      });
    }
    if (normalizedName.toLowerCase() === "[object object]") {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid sport name",
      });
    }
    if (!candidateSlug) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid sport name",
      });
    }

    const existingSport = await UserSport.findOne({
      createdBy: req.user._id,
      scope: "user",
      slug: candidateSlug,
    });

    if (existingSport) {
      if (!existingSport.isActive) {
        existingSport.isActive = true;
        existingSport.deletedAt = null;
        existingSport.deletedBy = null;
        await existingSport.save();
      }
      return res.status(200).json({
        success: true,
        message: "Sport already exists",
        data: existingSport,
      });
    }

    const sport = await UserSport.create({
      name: normalizedName,
      isActive: true,
      scope: "user",
      createdBy: req.user._id,
    });
    logCoachingSportAudit({
      sportId: sport._id,
      ownerUser: sport.createdBy,
      action: "CREATE",
      actorUser: req.user._id,
      actorRole: req.user.role,
      before: null,
      after: toObjectSnapshot(sport),
      metadata: { via: "public-create" },
    });

    res.status(201).json({
      success: true,
      message: "Sport created successfully",
      data: sport,
    });
  } catch (error) {
    console.error("Public create coaching sport error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update own coaching sport
// @route   PUT /api/coaching-sports/public/:id
// @access  Private
export const updateOwnCoachingSport = async (req, res) => {
  try {
    const { name } = req.body;
    const normalizedName = normalizeSportName(name);
    const candidateSlug = toSlug(normalizedName);
    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        message: "Sport name is required",
      });
    }
    if (normalizedName.toLowerCase() === "[object object]") {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid sport name",
      });
    }
    if (!candidateSlug) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid sport name",
      });
    }

    const sport = await UserSport.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      scope: "user",
      isActive: true,
    });

    if (!sport) {
      return res.status(404).json({
        success: false,
        message: "Sport not found",
      });
    }

    const duplicate = await UserSport.findOne({
      _id: { $ne: sport._id },
      createdBy: req.user._id,
      scope: "user",
      isActive: true,
      slug: candidateSlug,
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "A coaching sport with this name already exists",
      });
    }

    const before = toObjectSnapshot(sport);
    sport.name = normalizedName;
    await sport.save();

    logCoachingSportAudit({
      sportId: sport._id,
      ownerUser: sport.createdBy,
      action: "UPDATE",
      actorUser: req.user._id,
      actorRole: req.user.role,
      before,
      after: toObjectSnapshot(sport),
      metadata: { via: "public-update" },
    });

    return res.json({
      success: true,
      message: "Coaching sport updated successfully",
      data: sport,
    });
  } catch (error) {
    console.error("Update own coaching sport error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete own coaching sport
// @route   DELETE /api/coaching-sports/public/:id
// @access  Private
export const deleteOwnCoachingSport = async (req, res) => {
  try {
    const sport = await UserSport.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      scope: "user",
      isActive: true,
    });
    if (!sport) {
      return res.status(404).json({
        success: false,
        message: "Sport not found",
      });
    }

    const before = toObjectSnapshot(sport);
    sport.isActive = false;
    sport.deletedAt = new Date();
    sport.deletedBy = req.user._id;
    await sport.save();

    logCoachingSportAudit({
      sportId: sport._id,
      ownerUser: sport.createdBy,
      action: "DELETE",
      actorUser: req.user._id,
      actorRole: req.user.role,
      before,
      after: toObjectSnapshot(sport),
      metadata: { via: "public-delete" },
    });

    return res.json({
      success: true,
      message: "Coaching sport deleted successfully",
    });
  } catch (error) {
    console.error("Delete own coaching sport error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
