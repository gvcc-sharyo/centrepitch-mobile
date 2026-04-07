import AcademyRole from "../models/AcademyRole.js";
import SportsAcademy from "../models/SportsAcademy.js";
import Staff from "../models/Staff.js";

const DEFAULT_ROLES = [
  { name: "Manager", description: "Oversees day-to-day operations" },
  { name: "Coordinator", description: "Coordinates schedules and events" },
  { name: "Receptionist", description: "Handles front desk and inquiries" },
  { name: "Groundsman", description: "Maintains grounds and facilities" },
  { name: "Trainer", description: "Provides fitness and conditioning training" },
  { name: "Accountant", description: "Manages finances and billing" },
];

async function getAcademy(userId) {
  return SportsAcademy.findOne({ adminUser: userId });
}

/**
 * @desc    Get all roles for the academy (creates defaults on first call)
 * @route   GET /api/academy-roles
 * @access  Private (Academy Admin)
 */
export const getRoles = async (req, res) => {
  try {
    const academy = await getAcademy(req.user._id);
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    let roles = await AcademyRole.find({ academy: academy._id, isActive: true }).sort({ isDefault: -1, name: 1 });

    if (roles.length === 0) {
      const defaultDocs = DEFAULT_ROLES.map((r) => ({
        academy: academy._id,
        name: r.name,
        description: r.description,
        isDefault: true,
        createdBy: req.user._id,
      }));
      roles = await AcademyRole.insertMany(defaultDocs);
    }

    res.json({ success: true, data: roles });
  } catch (error) {
    console.error("Get roles error:", error);
    res.status(500).json({ success: false, message: "Error fetching roles", error: error.message });
  }
};

/**
 * @desc    Create a new role
 * @route   POST /api/academy-roles
 * @access  Private (Academy Admin)
 */
export const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Role name is required" });
    }

    const academy = await getAcademy(req.user._id);
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const existing = await AcademyRole.findOne({
      academy: academy._id,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        existing.description = description || existing.description;
        await existing.save();
        return res.status(200).json({ success: true, message: "Role reactivated", data: existing });
      }
      return res.status(400).json({ success: false, message: "A role with this name already exists" });
    }

    const role = await AcademyRole.create({
      academy: academy._id,
      name: name.trim(),
      description: description || "",
      permissions: permissions || [],
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: "Role created successfully", data: role });
  } catch (error) {
    console.error("Create role error:", error);
    res.status(500).json({ success: false, message: "Error creating role", error: error.message });
  }
};

/**
 * @desc    Update a role
 * @route   PUT /api/academy-roles/:id
 * @access  Private (Academy Admin)
 */
export const updateRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    const role = await AcademyRole.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    const academy = await getAcademy(req.user._id);
    if (!academy || role.academy.toString() !== academy._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (name && name.trim() !== role.name) {
      const duplicate = await AcademyRole.findOne({
        academy: academy._id,
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: role._id },
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: "A role with this name already exists" });
      }

      await Staff.updateMany(
        { academy: academy._id, role: role.name },
        { role: name.trim() }
      );

      role.name = name.trim();
    }

    if (description !== undefined) role.description = description;
    if (permissions) role.permissions = permissions;

    await role.save();

    res.json({ success: true, message: "Role updated successfully", data: role });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ success: false, message: "Error updating role", error: error.message });
  }
};

/**
 * @desc    Delete a role (soft delete)
 * @route   DELETE /api/academy-roles/:id
 * @access  Private (Academy Admin)
 */
export const deleteRole = async (req, res) => {
  try {
    const role = await AcademyRole.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    const academy = await getAcademy(req.user._id);
    if (!academy || role.academy.toString() !== academy._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const staffCount = await Staff.countDocuments({ academy: academy._id, role: role.name, isActive: true });
    if (staffCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete this role. ${staffCount} active staff member(s) are assigned to it. Reassign them first.`,
      });
    }

    role.isActive = false;
    await role.save();

    res.json({ success: true, message: "Role deleted successfully" });
  } catch (error) {
    console.error("Delete role error:", error);
    res.status(500).json({ success: false, message: "Error deleting role", error: error.message });
  }
};
