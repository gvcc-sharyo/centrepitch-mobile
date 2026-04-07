import Staff from '../models/Staff.js';
import Event from '../models/Event.js';
import SportsAcademy from '../models/SportsAcademy.js';

// @desc    Create staff member
// @route   POST /api/staff
// @access  Private (Organizer/Admin)
export const createStaff = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      specialization,
      experience,
      certifications,
      profilePhoto,
      address
    } = req.body;

    // If academy admin, link staff to their academy
    let academyId = null;
    if (req.user.role === 'academyadmin') {
      const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
      if (academy) academyId = academy._id;
    }

    const staff = await Staff.create({
      name,
      email,
      phone,
      role,
      specialization,
      experience,
      certifications,
      profilePhoto,
      address,
      addedBy: req.user._id,
      academy: academyId
    });

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: staff
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all staff members
// @route   GET /api/staff
// @access  Private (Organizer/Admin)
export const getStaffMembers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search, availability } = req.query;
    const query = { addedBy: req.user._id, isActive: true };

    if (role) query.role = role;
    if (availability) query.availability = availability;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { specialization: new RegExp(search, 'i') }
      ];
    }

    const staff = await Staff.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Staff.countDocuments(query);

    res.json({
      success: true,
      data: staff,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get staff members error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get staff member by ID
// @route   GET /api/staff/:id
// @access  Private (Organizer/Admin)
export const getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id)
      .populate('events.event', 'name eventType startDate');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error('Get staff by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update staff member
// @route   PUT /api/staff/:id
// @access  Private (Organizer/Admin)
export const updateStaff = async (req, res) => {
  try {
    let staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check ownership
    if (staff.addedBy.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    staff = await Staff.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      data: staff
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete staff member
// @route   DELETE /api/staff/:id
// @access  Private (Organizer/Admin)
export const deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check ownership
    if (staff.addedBy.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await Staff.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Staff member deleted successfully'
    });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Assign staff to event
// @route   POST /api/staff/:id/assign
// @access  Private (Organizer/Admin)
export const assignToEvent = async (req, res) => {
  try {
    const { eventId, role } = req.body;
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check ownership
    if (staff.addedBy.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if already assigned
    const isAssigned = staff.events.some(e => e.event.toString() === eventId);
    if (isAssigned) {
      return res.status(400).json({
        success: false,
        message: 'Staff member already assigned to this event'
      });
    }

    // Add to staff's events
    staff.events.push({
      event: eventId,
      role: role || staff.role,
      assignedAt: new Date(),
      status: 'assigned'
    });
    await staff.save();

    // Add to event's staff
    event.staff.push({
      user: staff.linkedUserId || null,
      role: role || staff.role,
      name: staff.name,
      email: staff.email,
      phone: staff.phone
    });
    await event.save();

    res.json({
      success: true,
      message: 'Staff assigned to event successfully'
    });
  } catch (error) {
    console.error('Assign to event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Remove staff from event
// @route   DELETE /api/staff/:id/events/:eventId
// @access  Private (Organizer/Admin)
export const removeFromEvent = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check ownership
    if (staff.addedBy.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Remove from staff's events
    staff.events = staff.events.filter(e => e.event.toString() !== req.params.eventId);
    await staff.save();

    // Remove from event's staff
    const event = await Event.findById(req.params.eventId);
    if (event) {
      event.staff = event.staff.filter(s => s.email !== staff.email);
      await event.save();
    }

    res.json({
      success: true,
      message: 'Staff removed from event successfully'
    });
  } catch (error) {
    console.error('Remove from event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get available staff for event
// @route   GET /api/staff/available/:eventId
// @access  Private (Organizer/Admin)
export const getAvailableStaff = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Get staff not assigned to this event
    const assignedStaffEmails = event.staff.map(s => s.email);
    
    const availableStaff = await Staff.find({
      addedBy: req.user._id,
      isActive: true,
      availability: 'available',
      email: { $nin: assignedStaffEmails }
    });

    res.json({
      success: true,
      data: availableStaff
    });
  } catch (error) {
    console.error('Get available staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
