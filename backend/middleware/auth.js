// ==========================================
// middleware/auth.js - COMPLETE FILE
// ==========================================
// All your existing functions are preserved
// New functions added at the bottom

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import SportsAcademy from '../models/SportsAcademy.js';
import Coach from '../models/Coach.js';

const normalizeRole = (value) => String(value || '').trim().toLowerCase();
const getEffectiveRole = (user) => normalizeRole(user?.activeRole || user?.role);

// ========================================
// EXISTING FUNCTIONS (UNCHANGED)
// ========================================

// Protect routes - require authentication
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret');
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      // Enforce single active session per user.
      // Tokens must carry a session id (sid) matching the one stored on user.
      if (!decoded.sid || !req.user.activeSessionId || decoded.sid !== req.user.activeSessionId) {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please login again.'
        });
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};

// Protect pending routes — for coach/academy users before approval
export const protectPending = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret');

      // Try User first (already approved users)
      let user = await User.findById(decoded.id).select('-password');
      if (user) {
        req.user = user;
        req.isPending = false;
        return next();
      }

      // Try Coach collection (pending users)
      const coach = await Coach.findById(decoded.id);
      if (coach) {
        req.pendingEntity = coach;
        req.pendingRole = 'coach';
        req.isPending = true;
        return next();
      }

      // Try Academy collection
      const academy = await SportsAcademy.findById(decoded.id);
      if (academy) {
        req.pendingEntity = academy;
        req.pendingRole = 'academy';
        req.isPending = true;
        return next();
      }

      return res.status(401).json({ success: false, message: 'Entity not found' });
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

// Authorize specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Check if user is super admin
export const isSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super Admin only.'
    });
  }
  next();
};

// Check if user is organizer or super admin
export const isOrganizerOrAdmin = (req, res, next) => {
  if (req.user.role !== 'organizer' && req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Organizer or Super Admin only.'
    });
  }
  next();
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret');
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Token is invalid, but we continue without user
      req.user = null;
    }
  }

  next();
};

// ========================================
// NEW FUNCTIONS FOR ACADEMY/COACH/COURT MODULES
// ========================================

/**
 * Check if user is Academy Admin
 * Allows superadmin to access academy admin routes
 */
export const isAcademyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const effectiveRole = getEffectiveRole(req.user);

  // Super admin can access academy admin routes
  if (effectiveRole === 'superadmin') {
    return next();
  }

  // Check for academy admin role
  if (effectiveRole !== 'academyadmin') {
    return res.status(403).json({
      success: false,
      message: 'Academy Admin access required'
    });
  }

  next();
};

/**
 * Verify Academy Admin has access to specific academy
 * Use this for routes like PUT /academies/:id, DELETE /academies/:id
 * Super admin can access any academy
 * Academy admin can only access their own academy
 */
export const verifyAcademyAccess = async (req, res, next) => {
  try {
    const academyId = req.params.id || req.params.academyId || req.body.academy;

    if (!academyId) {
      return res.status(400).json({
        success: false,
        message: 'Academy ID required'
      });
    }

    // Super admin can access any academy
    if (req.user.role === 'superadmin') {
      return next();
    }

    // Academy admin can only access their own academy
    if (req.user.role === 'academyadmin') {
      const academy = await SportsAcademy.findOne({
        _id: academyId,
        adminUser: req.user._id
      });

      if (!academy) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own academy.'
        });
      }

      // Attach academy to request for use in controller
      req.academy = academy;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions'
    });
  } catch (error) {
    console.error('Academy access verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying academy access'
    });
  }
};

/**
 * Verify Coach access
 * Super admin - can access any coach
 * Academy admin - can access coaches from their academy
 * Coach - can only access their own profile
 */
export const verifyCoachAccess = async (req, res, next) => {
  try {
    const coachId = req.params.id || req.params.coachId;

    if (!coachId) {
      return res.status(400).json({
        success: false,
        message: 'Coach ID required'
      });
    }

    // Super admin can access any coach
    if (req.user.role === 'superadmin') {
      return next();
    }

    // Academy admin can access coaches from their academy
    if (req.user.role === 'academyadmin') {
      const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
      
      if (!academy) {
        return res.status(404).json({
          success: false,
          message: 'Academy not found'
        });
      }

      const coach = await Coach.findOne({
        _id: coachId,
        academy: academy._id
      });

      if (!coach) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage coaches from your academy.'
        });
      }

      req.academy = academy;
      req.coach = coach;
      return next();
    }

    // Coach can only access their own profile
    if (req.user.role === 'coach') {
      const coach = await Coach.findOne({
        _id: coachId,
        userId: req.user._id
      });

      if (!coach) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own profile.'
        });
      }

      req.coach = coach;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions'
    });
  } catch (error) {
    console.error('Coach access verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying coach access'
    });
  }
};

/**
 * Verify user can approve coaches
 * Super admin - can approve any coach
 * Academy admin - can approve only ACADEMY_COACH type from their academy
 */
export const canApproveCoach = async (req, res, next) => {
  try {
    const coachId = req.params.id || req.params.coachId;

    if (!coachId) {
      return res.status(400).json({
        success: false,
        message: 'Coach ID required'
      });
    }

    const coach = await Coach.findById(coachId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Super admin can approve any coach
    if (req.user.role === 'superadmin') {
      req.coach = coach;
      return next();
    }

    // Academy admin can only approve academy coaches from their academy
    if (req.user.role === 'academyadmin') {
      // Coach must be ACADEMY_COACH type
      if (coach.coachType !== 'ACADEMY_COACH') {
        return res.status(403).json({
          success: false,
          message: 'Academy admins can only approve academy coaches'
        });
      }

      const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
      
      if (!academy) {
        return res.status(404).json({
          success: false,
          message: 'Academy not found'
        });
      }

      // Check if coach belongs to this academy
      if (!coach.academy || coach.academy.toString() !== academy._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only approve coaches from your academy'
        });
      }

      req.academy = academy;
      req.coach = coach;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions to approve coaches'
    });
  } catch (error) {
    console.error('Coach approval check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking coach approval permissions'
    });
  }
};

/**
 * Verify user can approve courts
 * Super admin - can approve any court
 * Academy admin - can approve courts from their academy
 */
export const canApproveCourt = async (req, res, next) => {
  try {
    // Super admin can approve any court
    if (req.user.role === 'superadmin') {
      return next();
    }

    // Academy admin can approve courts from their academy
    if (req.user.role === 'academyadmin') {
      const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
      
      if (!academy) {
        return res.status(404).json({
          success: false,
          message: 'Academy not found'
        });
      }

      req.academy = academy;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Court approval requires Super Admin or Academy Admin role'
    });
  } catch (error) {
    console.error('Court approval check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking court approval permissions'
    });
  }
};

/**
 * Check if user is a coach
 */
export const isCoach = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const effectiveRole = getEffectiveRole(req.user);

  // Super admin can access coach routes
  if (effectiveRole === 'superadmin') {
    return next();
  }

  if (effectiveRole !== 'coach') {
    return res.status(403).json({
      success: false,
      message: 'Coach access required'
    });
  }

  next();
};

/**
 * Check if user is staff
 */
export const isStaff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Super admin can access staff routes
  if (req.user.role === 'superadmin') {
    return next();
  }

  if (req.user.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Staff access required'
    });
  }

  next();
};

/**
 * Check if user is a player (or roles that can act as players)
 * Players can book courts, organizers and admins can also book as players
 */
export const isPlayer = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // These roles can book courts and act as players
  const allowedRoles = ['player', 'coach', 'organizer'];
  const effectiveRole = getEffectiveRole(req.user);

  if (!allowedRoles.includes(effectiveRole)) {
    return res.status(403).json({
      success: false,
      message: 'Player access required. Only players, organizers, and admins can book courts.'
    });
  }

  next();
};

/**
 * Multi-role authorization
 * Usage: authorizeRoles('superadmin', 'academyadmin')
 * More flexible than the existing authorize function
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};