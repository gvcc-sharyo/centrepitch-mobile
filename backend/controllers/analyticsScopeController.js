import Coach from '../models/Coach.js';
import Player from '../models/Player.js';
import SportsAcademy from '../models/SportsAcademy.js';
import CoachStudentRelation from '../models/CoachStudentRelation.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const findCoachForUser = async (userId) => Coach.findOne({ userId });

/**
 * Whether the logged-in user may view CA-1 analytics for targetUserId (User ObjectId string).
 */
export async function canAccessPlayerAnalytics(user, targetUserId) {
  const role = String(user?.role || '').toLowerCase();
  const tid = String(targetUserId || '');

  if (!tid) return false;
  if (tid === String(user._id)) return true;
  if (role === 'superadmin') return true;

  if (role === 'player') return false;

  if (role === 'coach') {
    const coach = await findCoachForUser(user._id);
    if (!coach) return false;
    const isObjectId = mongoose.Types.ObjectId.isValid(tid);
    const playerDoc = isObjectId
      ? await Player.findOne({ user: tid }).select('_id')
      : await Player.findOne({ name: tid }).select('_id');
    if (!playerDoc) return false;
    const rel = await CoachStudentRelation.findOne({
      coach: coach._id,
      player: playerDoc._id,
      status: 'active',
    });
    return Boolean(rel);
  }

  if (role === 'academyadmin') {
    const academy = await SportsAcademy.findOne({ adminUser: user._id });
    if (!academy) return false;
    const isObjectId = mongoose.Types.ObjectId.isValid(tid);
    const q = isObjectId ? { user: tid } : { name: tid };
    const playerDoc = await Player.findOne({
      ...q,
      academies: academy._id,
      isActive: true,
    }).select('_id');
    return Boolean(playerDoc);
  }

  return false;
}

// @route   GET /api/analytics/scope-players
// @access  Private (player | coach | academyadmin)
export const getScopePlayers = async (req, res) => {
  try {
    const user = req.user;
    const role = String(user.role || '').toLowerCase();

    if (role === 'superadmin') {
      return res.json({
        success: true,
        scope: 'global',
        players: [],
        message: 'Use admin analytics for full directory',
      });
    }

    if (role === 'player') {
      const u = await User.findById(user._id).select('firstName lastName email');
      return res.json({
        success: true,
        scope: 'self',
        players: [
          {
            userId: String(user._id),
            name: `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || 'Player',
            email: u?.email || '',
          },
        ],
      });
    }

    if (role === 'coach') {
      const coach = await findCoachForUser(user._id);
      if (!coach) {
        return res.status(404).json({ success: false, message: 'Coach profile not found' });
      }
      const relations = await CoachStudentRelation.find({
        coach: coach._id,
        status: 'active',
      }).populate({
        path: 'player',
        select: 'name email user',
        populate: { path: 'user', select: 'firstName lastName email' },
      });

      const players = [];
      const seen = new Set();
      for (const r of relations) {
        const p = r.player;
        if (!p?.user) continue;
        const uid = String(p.user._id || p.user);
        if (seen.has(uid)) continue;
        seen.add(uid);
        const u = p.user;
        const name =
          p.name ||
          `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
          'Player';
        players.push({
          userId: uid,
          name,
          email: u.email || p.email || '',
        });
      }
      return res.json({ success: true, scope: 'coach', players });
    }

    if (role === 'academyadmin') {
      const academy = await SportsAcademy.findOne({ adminUser: user._id });
      if (!academy) {
        return res.status(404).json({ success: false, message: 'Academy not found' });
      }
      const playerDocs = await Player.find({
        academies: academy._id,
        isActive: true,
      })
        .populate('user', 'firstName lastName email')
        .select('name email user')
        .lean();

      const players = playerDocs
        .filter((p) => p.user)
        .map((p) => ({
          userId: String(p.user._id),
          name:
            p.name ||
            `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() ||
            'Player',
          email: p.user.email || p.email || '',
        }));
      return res.json({
        success: true,
        scope: 'academy',
        academyId: String(academy._id),
        players,
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Analytics directory not available for this role',
    });
  } catch (error) {
    console.error('[Analytics scope-players]', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   GET /api/analytics/verify-player/:playerId
// @access  Private
export const verifyPlayerAccess = async (req, res) => {
  try {
    const ok = await canAccessPlayerAnalytics(req.user, req.params.playerId);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this player analytics' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[Analytics verify-player]', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
