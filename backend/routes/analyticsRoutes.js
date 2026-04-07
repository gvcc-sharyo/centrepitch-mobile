/**
 * analyticsRoutes.js
 * Proxy routes to CA-1 analytics engine.
 *
 * All requests are authenticated via CentrePitch JWT (protect middleware).
 * The caller's role is injected as X-User-Role so CA-1 can tier-filter the response.
 * CA-1 never receives JWT tokens — it only sees role strings.
 */
import express from 'express';
import { protect } from '../middleware/auth.js';
import { getScopePlayers, verifyPlayerAccess, canAccessPlayerAnalytics } from '../controllers/analyticsScopeController.js';

const router = express.Router();
/** Set to your CA-1 analytics API base (no trailing slash). Defaults to localhost — use LAN IP in dev if the API runs elsewhere. */
const CA1_BASE_URL = process.env.ANALYTICS_API_URL || 'http://localhost:8001';

router.use(protect);

// CentrePitch-only: who can see which players' analytics (not proxied to CA-1)
router.get('/scope-players', getScopePlayers);
router.get('/verify-player/:playerId', verifyPlayerAccess);

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Middleware: Enforce access control for viewing player analytics.
 * - Players can only view their own analytics
 * - Coaches can view their students' analytics
 * - SuperAdmins can view anyone's analytics
 */
async function requirePlayerAnalyticsAccess(req, res, next) {
  try {
    const targetPlayerId = req.params.playerId;
    const hasAccess = await canAccessPlayerAnalytics(req.user, targetPlayerId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this player analytics'
      });
    }

    next();
  } catch (error) {
    console.error('[Analytics Access Control]', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * Middleware: For players viewing their own analytics, inject their user ID.
 * For coaches/admins, they need to explicitly request a specific player's analytics.
 */
async function injectPlayerIdForOwnAnalytics(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();

  // If it's a player without a specific playerId, use their own ID
  if (role === 'player') {
    req.query.playerId = String(req.user._id);
  }

  next();
}

async function proxyGet(req, res, ca1Path) {
  try {
    // Build query string from req.query to include injected parameters (e.g., playerId)
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${CA1_BASE_URL}${ca1Path}${queryString ? '?' + queryString : ''}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': req.user.role || 'anonymous',
      },
    });
    const body = await response.json();
    res.status(response.status).json(body);
  } catch (err) {
    console.error(`[Analytics Proxy] GET ${ca1Path} — ${err.message} (CA-1 at ${CA1_BASE_URL})`);
    res.status(502).json({ success: false, message: 'Analytics service unavailable' });
  }
}

async function proxyPost(req, res, ca1Path) {
  try {
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${CA1_BASE_URL}${ca1Path}${queryString ? '?' + queryString : ''}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': req.user.role || 'anonymous',
      },
      body: JSON.stringify(req.body || {}),
    });
    const body = await response.json();
    res.status(response.status).json(body);
  } catch (err) {
    console.error(`[Analytics Proxy] POST ${ca1Path} — ${err.message} (CA-1 at ${CA1_BASE_URL})`);
    res.status(502).json({ success: false, message: 'Analytics service unavailable' });
  }
}

async function proxyPut(req, res, ca1Path) {
  try {
    const response = await fetch(`${CA1_BASE_URL}${ca1Path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': req.user.role || 'anonymous',
      },
      body: JSON.stringify(req.body),
    });
    const body = await response.json();
    res.status(response.status).json(body);
  } catch (err) {
    console.error(`[Analytics Proxy] PUT ${ca1Path} — ${err.message} (CA-1 at ${CA1_BASE_URL})`);
    res.status(502).json({ success: false, message: 'Analytics service unavailable' });
  }
}

async function proxyDelete(req, res, ca1Path) {
  try {
    const response = await fetch(`${CA1_BASE_URL}${ca1Path}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': req.user.role || 'anonymous',
      },
    });
    const body = await response.json();
    res.status(response.status).json(body);
  } catch (err) {
    console.error(`[Analytics Proxy] DELETE ${ca1Path} — ${err.message} (CA-1 at ${CA1_BASE_URL})`);
    res.status(502).json({ success: false, message: 'Analytics service unavailable' });
  }
}

// ─── MATCH ANALYTICS ──────────────────────────────────────────────────────────

/**
 * GET /api/analytics/matches
 * Returns matches filtered by role:
 * - Player: only their own matches
 * - Coach: all their students' matches
 * - SuperAdmin: all matches
 */
router.get('/matches',
  injectPlayerIdForOwnAnalytics,
  (req, res) => proxyGet(req, res, `/matches`));

router.get('/matches/:matchId/summary',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/summary`));

router.get('/matches/:matchId/full-analytics',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/full-analytics`));

router.get('/matches/:matchId/score-progression',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/score-progression`));

router.get('/matches/:matchId/win-probability',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/win-probability`));

router.get('/matches/:matchId/momentum',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/momentum`));

router.get('/matches/:matchId/turning-points',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/turning-points`));

router.get('/matches/:matchId/rally-analysis',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/rally-analysis`));

router.get('/matches/:matchId/ending-types',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/ending-types`));

router.get('/matches/:matchId/pressure-analysis',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/pressure-analysis`));

router.get('/matches/:matchId/shot-stats',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/shot-stats`));

router.get('/matches/:matchId/shot-sequences',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/shot-sequences`));

router.get('/matches/:matchId/sets/:setNumber/analytics',
  (req, res) => proxyGet(req, res, `/matches/${req.params.matchId}/sets/${req.params.setNumber}/analytics`));

router.post('/matches/:matchId/coaching-brief',
  (req, res) => proxyPost(req, res, `/matches/${req.params.matchId}/coaching-brief`));

// Admin utility: clear cached analytics for a match (superadmin only)
router.delete('/matches/:matchId/cache', (req, res) => {
  if (String(req.user?.role || '').toLowerCase() !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  return proxyDelete(req, res, `/matches/${req.params.matchId}/cache`);
});

// ─── PLAYER ANALYTICS ─────────────────────────────────────────────────────────

router.get('/players',
  (req, res) => proxyGet(req, res, '/players'));

/** Superadmin: wipe analytics_player_profiles and rebuild from matchstats + users + players */
router.post('/players/rebuild-profiles', (req, res) => {
  if (String(req.user?.role || '').toLowerCase() !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  return proxyPost(req, res, '/players/rebuild-profiles');
});

router.get('/players/:playerId/profile',
  requirePlayerAnalyticsAccess,
  (req, res) => proxyGet(req, res, `/players/${req.params.playerId}/profile`));

/**
 * GET /api/analytics/players/:playerId/matches
 * Returns a specific player's matches.
 * Access verified: player (own only), coach (their students), superadmin (all)
 */
router.get('/players/:playerId/matches',
  requirePlayerAnalyticsAccess,
  (req, res) => proxyGet(req, res, `/players/${req.params.playerId}/matches`));

router.get('/players/compare',
  (req, res) => proxyGet(req, res, '/players/compare'));

router.get('/players/:playerId/trends',
  requirePlayerAnalyticsAccess,
  (req, res) => proxyGet(req, res, `/players/${req.params.playerId}/trends`));

router.get('/players/:playerId/last10-trends',
  requirePlayerAnalyticsAccess,
  (req, res) => proxyGet(req, res, `/players/${req.params.playerId}/last10-trends`));

router.get('/players/:playerId/h2h',
  requirePlayerAnalyticsAccess,
  (req, res) => proxyGet(req, res, `/players/${req.params.playerId}/h2h`));

router.get('/players/:playerId/pressure-rating',
  requirePlayerAnalyticsAccess,
  (req, res) => proxyGet(req, res, `/players/${req.params.playerId}/pressure-rating`));

// ─── PERMISSIONS (superadmin only) ────────────────────────────────────────────

router.get('/permissions',
  (req, res) => proxyGet(req, res, '/permissions'));

router.put('/permissions/:role',
  (req, res) => proxyPut(req, res, `/permissions/${req.params.role}`));

// ─── MODULES (superadmin only) ─────────────────────────────────────────────

router.get('/modules',
  (req, res) => proxyGet(req, res, '/modules'));

router.put('/modules/:moduleId',
  (req, res) => proxyPut(req, res, `/modules/${req.params.moduleId}`));

export default router;
