import mongoose from 'mongoose';
import User from '../models/User.js';
import Player from '../models/Player.js';
import Sport from '../models/Sport.js';
import RoleSportAuditTrail from '../models/RoleSportAuditTrail.js';
import {
  DUPLICATE_EMAIL_MESSAGE,
  DUPLICATE_PHONE_MESSAGE,
} from '../constants/contactErrors.js';

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      profilePhoto,
      description,
      address,
      socialLinks,
      dateOfBirth,
      gender,
      sportsInterests,
      organizationName,
      organizationLogo,
      theme
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const incomingEmail = email !== undefined && email !== null ? String(email).trim().toLowerCase() : undefined;
    const incomingPhone = phone !== undefined && phone !== null ? String(phone).trim() : undefined;

    if (incomingEmail !== undefined) {
      if (!incomingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }
      if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(incomingEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email'
        });
      }
      if (incomingEmail !== String(user.email || '').toLowerCase()) {
        const emailTaken = await User.findOne({
          email: incomingEmail,
          _id: { $ne: user._id }
        });
        if (emailTaken) {
          return res.status(409).json({
            success: false,
            message: DUPLICATE_EMAIL_MESSAGE
          });
        }
      }
    }

    // Validate phone format (Indian: 10 digits, starts with 6–9)
    if (incomingPhone) {
      const digits = incomingPhone.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(digits)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number (10 digits, starts with 6–9)'
        });
      }
      if (incomingPhone !== String(user.phone || '').trim()) {
        const phoneTaken = await User.findOne({
          phone: incomingPhone,
          _id: { $ne: user._id }
        });
        if (phoneTaken) {
          return res.status(409).json({
            success: false,
            message: DUPLICATE_PHONE_MESSAGE
          });
        }
      }
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (incomingEmail !== undefined) {
      const previousEmail = String(user.email || '').toLowerCase();
      if (incomingEmail !== previousEmail) {
        user.email = incomingEmail;
        user.isEmailVerified = false;
        user.isVerified = false;
        user.emailOtp = undefined;
        user.emailOtpExpire = undefined;
        user.otp = undefined;
        user.otpExpire = undefined;
      }
    }
    if (incomingPhone !== undefined) {
      const previousPhone = String(user.phone || '').trim();
      if (incomingPhone && incomingPhone !== previousPhone) {
        // Phone changed: require re-verification of the new number.
        user.phone = incomingPhone;
        user.isPhoneVerified = false;
        user.phoneOtp = undefined;
        user.phoneOtpExpire = undefined;
      } else if (!incomingPhone && previousPhone) {
        user.phone = '';
        user.isPhoneVerified = false;
        user.phoneOtp = undefined;
        user.phoneOtpExpire = undefined;
      } else if (incomingPhone) {
        user.phone = incomingPhone;
      }
    }
    if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;
    if (description !== undefined) user.description = description;
    if (address) user.address = address;
    if (socialLinks) user.socialLinks = socialLinks;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (gender) user.gender = gender;
    if (sportsInterests) user.sportsInterests = sportsInterests;
    if (organizationName) user.organizationName = organizationName;
    if (organizationLogo !== undefined) user.organizationLogo = organizationLogo;
    if (theme) user.theme = theme;

    const runInBackground = (label, fn) => {
      Promise.resolve()
        .then(fn)
        .catch((error) => {
          console.error(`${label} failed:`, error.message);
        });
    };

    const logRoleSportAudit = ({
      entityType,
      entityId,
      field,
      action = 'UPDATE',
      actorUser,
      actorRole = null,
      before = null,
      after = null,
      metadata = {},
    } = {}) => {
      if (!entityType || !entityId || !field || !actorUser) return;
      runInBackground('Role sport audit log', async () => {
        await RoleSportAuditTrail.create({
          entityType,
          entityId,
          field,
          action,
          actorUser,
          actorRole,
          before,
          after,
          metadata,
        });
      });
    };

    let organizerSportsBefore = null;
    let organizerSportsAfter = null;

    if (req.body.organizerSports !== undefined) {
      const active = String(user.activeRole || user.role || '').toLowerCase();
      if (active === 'organizer') {
        organizerSportsBefore = Array.isArray(user.organizerSports)
          ? user.organizerSports.map((id) => String(id))
          : [];
        const raw = Array.isArray(req.body.organizerSports) ? req.body.organizerSports : [];
        const ids = [
          ...new Set(
            raw
              .map((id) => String(id || '').trim())
              .filter((id) => id && mongoose.Types.ObjectId.isValid(id)),
          ),
        ];
        if (ids.length) {
          const count = await Sport.countDocuments({ _id: { $in: ids }, isActive: true });
          if (count !== ids.length) {
            return res.status(400).json({
              success: false,
              message: 'One or more sports are invalid or inactive',
            });
          }
        }
        user.organizerSports = ids;
        organizerSportsAfter = ids;
      }
    }

    await user.save();

    if (organizerSportsAfter) {
      logRoleSportAudit({
        entityType: 'USER',
        entityId: user._id,
        field: 'organizerSports',
        action: 'SET',
        actorUser: req.user._id,
        actorRole: req.user.role,
        before: organizerSportsBefore,
        after: organizerSportsAfter,
        metadata: {
          activeRole: String(user.activeRole || user.role || ''),
          via: 'updateProfile',
        },
      });
    }

    // Keep Player profile in sync when user updates email/phone.
    const playerProfile = await Player.findOne({ user: user._id });
    if (playerProfile) {
      if (incomingEmail !== undefined) playerProfile.email = user.email;
      if (incomingPhone !== undefined) playerProfile.phone = user.phone || '';
      try {
        await playerProfile.save();
      } catch (playerSyncError) {
        if (playerSyncError?.code === 11000) {
          return res.status(409).json({
            success: false,
            message: DUPLICATE_EMAIL_MESSAGE
          });
        }
        throw playerSyncError;
      }
    }

    let responseUser = user;
    if (String(user.activeRole || user.role || '').toLowerCase() === 'organizer') {
      responseUser = await User.findById(user._id)
        .select('-password')
        .populate('organizerSports', 'name slug description');
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: responseUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -resetPasswordToken -resetPasswordExpire -otp -otpExpire');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add achievement
// @route   POST /api/users/achievements
// @access  Private
export const addAchievement = async (req, res) => {
  try {
    const { title, description, date, eventId } = req.body;

    const user = await User.findById(req.user._id);

    user.achievements.push({
      title,
      description,
      date,
      eventId
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Achievement added successfully',
      data: user.achievements
    });
  } catch (error) {
    console.error('Add achievement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update achievement
// @route   PUT /api/users/achievements/:achievementId
// @access  Private
export const updateAchievement = async (req, res) => {
  try {
    const { title, description, date, eventId } = req.body;

    const user = await User.findById(req.user._id);
    const achievement = user.achievements.id(req.params.achievementId);

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found'
      });
    }

    if (title) achievement.title = title;
    if (description) achievement.description = description;
    if (date) achievement.date = date;
    if (eventId) achievement.eventId = eventId;

    await user.save();

    res.json({
      success: true,
      message: 'Achievement updated successfully',
      data: user.achievements
    });
  } catch (error) {
    console.error('Update achievement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete achievement
// @route   DELETE /api/users/achievements/:achievementId
// @access  Private
export const deleteAchievement = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    user.achievements = user.achievements.filter(
      ach => ach._id.toString() !== req.params.achievementId
    );

    await user.save();

    res.json({
      success: true,
      message: 'Achievement deleted successfully',
      data: user.achievements
    });
  } catch (error) {
    console.error('Delete achievement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get user performance stats
// @route   GET /api/users/performance
// @access  Private
export const getPerformanceStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('performanceStats achievements')
      .populate('achievements.eventId', 'name eventType');

    res.json({
      success: true,
      data: {
        stats: user.performanceStats,
        achievements: user.achievements
      }
    });
  } catch (error) {
    console.error('Get performance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update user performance stats
// @route   PUT /api/users/performance
// @access  Private (Admin/Organizer)
export const updatePerformanceStats = async (req, res) => {
  try {
    const { userId, stats } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (stats.eventsParticipated !== undefined) {
      user.performanceStats.eventsParticipated = stats.eventsParticipated;
    }
    if (stats.wins !== undefined) user.performanceStats.wins = stats.wins;
    if (stats.losses !== undefined) user.performanceStats.losses = stats.losses;
    if (stats.draws !== undefined) user.performanceStats.draws = stats.draws;
    if (stats.rating !== undefined) user.performanceStats.rating = stats.rating;

    await user.save();

    res.json({
      success: true,
      message: 'Performance stats updated',
      data: user.performanceStats
    });
  } catch (error) {
    console.error('Update performance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Upload profile photo
// @route   POST /api/users/upload-photo
// @access  Private
export const uploadProfilePhoto = async (req, res) => {
  try {
    const { profilePhoto } = req.body;

    const user = await User.findById(req.user._id);
    user.profilePhoto = profilePhoto;
    await user.save();

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: { profilePhoto: user.profilePhoto }
    });
  } catch (error) {
    console.error('Upload profile photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
