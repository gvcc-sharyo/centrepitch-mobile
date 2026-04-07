/**
 * analyticsService.js
 * Bridge between CentrePitch match data and the CA-1 analytics engine.
 *
 * Called fire-and-forget from matchController when a match is marked completed.
 * Never awaited — analytics never block match scoring.
 *
 * Data contract for detailed analytics (scorer stores in MatchStat.teamTotals):
 * {
 *   points: [
 *     {
 *       point_id: 1,           // 1-indexed within set
 *       set_number: 1,
 *       score_before: "0-0",   // "score_a-score_b" before this point
 *       point_winner: "<playerId>",
 *       server: "<playerId>",  // optional
 *       rally_shots: 5,        // optional
 *       rally_duration_sec: 8.2, // optional
 *       ending_type: "smash_winner" // optional
 *     }
 *   ],
 *   sets: [
 *     { set_number: 1, score_a: 21, score_b: 18, winner: "<playerId>", is_deuce: false }
 *   ]
 * }
 *
 * If this structure is absent, a minimal match record is still ingested.
 * Minimal data enables win/loss profiles but skips rally/shot/serve modules.
 */

import MatchStat from '../models/MatchStat.js';

const CA1_BASE_URL = process.env.ANALYTICS_API_URL || 'http://localhost:8001';

/**
 * Main entry point — called from matchController on completion.
 * Loads MatchStat, formats payload, POSTs to CA-1.
 */
export const ingestMatchAnalytics = async (event, match) => {
  try {
    const matchId = `MATCH_${match._id}`;

    // Load MatchStat documents for this match (one per participant)
    const statsArr = await MatchStat.find({
      event: event._id,
      matchId: match._id,
    }).lean();

    const payload = _buildPayload(event, match, statsArr, matchId);

    const response = await fetch(`${CA1_BASE_URL}/matches`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Analytics] CA-1 ingest failed (${response.status}): ${body}`);
    } else {
      console.log(`[Analytics] Match ${matchId} ingested successfully.`);
    }
  } catch (err) {
    // Never rethrow — analytics must never crash the scoring flow
    console.error('[Analytics] Ingest error:', err.message);
  }
};

// ─── PAYLOAD BUILDER ─────────────────────────────────────────────────────────

function _buildPayload(event, match, statsArr, matchId) {
  const isIndividual = event.gameFormat === 'individual' || event.gameFormat === 'doubles';

  // Participant IDs
  const playerAId = isIndividual
    ? String(match.player1?._id || match.player1)
    : String(match.team1?._id  || match.team1);

  const playerBId = isIndividual
    ? String(match.player2?._id || match.player2)
    : String(match.team2?._id  || match.team2);

  const winnerId = match.result?.winner
    ? String(match.result.winner?._id || match.result.winner)
    : null;

  // Participant names from MatchStat or fallback to ID
  const statA = statsArr.find(s => String(s.participant.refId) === playerAId);
  const statB = statsArr.find(s => String(s.participant.refId) === playerBId);

  const playerAName = statA?.participant?.name || playerAId;
  const playerBName = statB?.participant?.name || playerBId;

  // Sport from event type (eventType: "badminton", "tennis", etc.)
  const sportId = (event.eventType || 'badminton').toLowerCase();

  // Try to pull structured point-level data the scorer stored in teamTotals
  // Both participants may have data; prefer whichever has the points array
  const structuredData = _extractStructuredData(statA, statB);

  const { sets, points, shots, setsWonA, setsWonB } = _buildMatchData(
    structuredData, matchId, playerAId, playerBId, winnerId, match
  );

  const scheduleMatchId = String(match._id || match);
  const centrepitchEventId = String(event._id);

  return {
    match_info: {
      match_id:    matchId,
      /** Join keys back to CentrePitch Event + embedded schedule match (no prefix). */
      centrepitch_event_id:  centrepitchEventId,
      centrepitch_match_id:  scheduleMatchId,
      sport_id:    sportId,
      date:        (match.dateTime || new Date()).toISOString(),
      venue:       match.venue || event.location?.venue || null,
      player_a:    { player_id: playerAId, name: playerAName },
      player_b:    { player_id: playerBId, name: playerBName },
      player_a_id: playerAId,
      player_b_id: playerBId,
      winner_id:   winnerId,
      sets_won:    { player_a: setsWonA, player_b: setsWonB },
      total_sets:  sets.length || 1,
    },
    sets,
    points,
    shots,
  };
}

/**
 * Extract structured analytics data from MatchStat teamTotals.
 * Scorer stores: { points: [...], sets: [...] } in teamTotals.
 * Returns null if no structured data is available.
 */
function _extractStructuredData(statA, statB) {
  for (const stat of [statA, statB]) {
    if (stat?.teamTotals?.points?.length) {
      return stat.teamTotals;
    }
  }
  return null;
}

/**
 * Build sets, points, shots arrays.
 * Falls back to a synthetic single-set structure when no point data is available.
 */
function _buildMatchData(structured, matchId, playerAId, playerBId, winnerId, match) {
  if (structured?.points?.length) {
    return _buildFromStructuredData(structured, matchId, playerAId, playerBId);
  }
  return _buildMinimal(matchId, playerAId, playerBId, winnerId, match);
}

function _buildFromStructuredData(structured, matchId, playerAId, playerBId) {
  const rawSets  = structured.sets  || [];
  const rawPoints = structured.points || [];

  // Group points by set
  const pointsBySet = {};
  for (const pt of rawPoints) {
    const sn = pt.set_number || 1;
    (pointsBySet[sn] = pointsBySet[sn] || []).push(pt);
  }

  const sets  = [];
  const points = [];

  for (const s of rawSets) {
    const sn     = s.set_number;
    const setId  = `${matchId}-S${sn}`;
    const setPts = pointsBySet[sn] || [];

    sets.push({
      set_id:       setId,
      set_number:   sn,
      score_a:      s.score_a ?? 0,
      score_b:      s.score_b ?? 0,
      winner_id:    s.winner  || null,
      is_deuce:     s.is_deuce || false,
      total_points: setPts.length,
      points: setPts.map(pt => ({
        point_id:           pt.point_id,
        point_number:       pt.point_id,
        global_point_number: pt.point_id,
        set_id:             setId,
        set_number:         sn,
        score_before:       pt.score_before || '0-0',
        server:             pt.server       || null,
        rally_shots:        pt.rally_shots  || null,
        rally_duration_sec: pt.rally_duration_sec || null,
        point_winner:       pt.point_winner,
        winner_id:          pt.point_winner,
        ending_type:        pt.ending_type || pt.ending_shot || null,
      })),
    });

    for (const pt of setPts) {
      points.push({
        point_id:           pt.point_id,
        point_number:       pt.point_id,
        global_point_number: pt.point_id,
        set_id:             setId,
        set_number:         sn,
        score_before:       pt.score_before || '0-0',
        server:             pt.server       || null,
        rally_shots:        pt.rally_shots  || null,
        rally_duration_sec: pt.rally_duration_sec || null,
        point_winner:       pt.point_winner,
        winner_id:          pt.point_winner,
        ending_type:        pt.ending_type || pt.ending_shot || null,
      });
    }
  }

  const setsWonA = sets.filter(s => s.winner_id === playerAId).length;
  const setsWonB = sets.filter(s => s.winner_id === playerBId).length;

  // Shots are optional — structured data may include them
  const shots = (structured.shots || []).map(sh => ({
    ...sh,
    match_id: matchId,
  }));

  return { sets, points, shots, setsWonA, setsWonB };
}

/**
 * Minimal fallback when no point data was recorded.
 * Creates a synthetic single set from the score string ("21-18" or "2-0").
 * The analytics engine will run with limited modules (score/win-prob/momentum skip).
 */
function _buildMinimal(matchId, playerAId, playerBId, winnerId, match) {
  const scoreStr  = match.result?.score || '0-0';
  const [sa, sb]  = _parseScore(scoreStr);
  const setId     = `${matchId}-S1`;
  const setsWonA  = winnerId === playerAId ? 1 : 0;
  const setsWonB  = winnerId === playerBId ? 1 : 0;

  const sets = [{
    set_id:       setId,
    set_number:   1,
    score_a:      sa,
    score_b:      sb,
    winner_id:    winnerId,
    is_deuce:     false,
    total_points: 0,
    points:       [],
  }];

  return { sets, points: [], shots: [], setsWonA, setsWonB };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function _parseScore(scoreStr) {
  // Handles "21-18", "21-18, 21-15", "2-0" etc.
  // Take the first set score if multiple sets listed.
  const first = String(scoreStr).split(',')[0].trim();
  const parts = first.split('-').map(n => parseInt(n, 10)).filter(Number.isFinite);
  return [parts[0] ?? 0, parts[1] ?? 0];
}
