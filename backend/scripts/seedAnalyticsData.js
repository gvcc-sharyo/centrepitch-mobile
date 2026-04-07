/**
 * seedAnalyticsData.js
 *
 * Creates 2 seed players, 1 seed event, and 3 completed badminton matches
 * with full point-level data stored in MatchStat.teamTotals.
 * Triggers CA-1 ingest for each match on completion.
 *
 * Usage: node --env-file=.env scripts/seedAnalyticsData.js
 * Requires CA-1 to be running (default: http://localhost:8001).
 *
 * Safe to re-run — seed docs are upserted by email/name.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Event from '../models/Event.js';
import MatchStat from '../models/MatchStat.js';
import { ingestMatchAnalytics } from '../services/analyticsService.js';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/centre_pitch';

// ─── POINT GENERATOR ──────────────────────────────────────────────────────────

const ENDING_TYPES = ['smash_winner', 'net_kill', 'forced_error', 'unforced_error', 'drop_winner', 'drive_winner'];
const SHOT_TYPES   = ['smash', 'drop', 'clear', 'drive', 'net_shot', 'lift', 'push'];

function makePoints(setNumber, targetA, targetB, playerAId, playerBId) {
  const points = [];
  let scoreA = 0;
  let scoreB = 0;
  let pointId = 1;
  let server = playerAId; // A serves first

  while (true) {
    // Determine winner of this rally — weight slightly toward whoever is behind
    const aWeight = scoreA < scoreB ? 0.55 : 0.45;
    const winner = Math.random() < aWeight ? playerAId : playerBId;

    points.push({
      point_id:           pointId,
      set_number:         setNumber,
      score_before:       `${scoreA}-${scoreB}`,
      point_winner:       winner,
      server:             server,
      rally_shots:        Math.floor(Math.random() * 12) + 1,
      rally_duration_sec: parseFloat((Math.random() * 15 + 2).toFixed(1)),
      ending_type:        ENDING_TYPES[Math.floor(Math.random() * ENDING_TYPES.length)],
    });

    if (winner === playerAId) scoreA++; else scoreB++;
    server = winner; // winner serves next in badminton
    pointId++;

    // Check for set end (first to target, must lead by 2; cap at +2 if deuce)
    const maxScore = Math.max(scoreA, scoreB);
    const minScore = Math.min(scoreA, scoreB);
    if (maxScore >= Math.max(targetA, targetB) && maxScore - minScore >= 2) break;
    if (maxScore >= 30) break; // hard cap (rubber game rule)
  }

  return { points, finalA: scoreA, finalB: scoreB };
}

function makeSetRecord(setNumber, scoreA, scoreB, winnerIdStr, isDeuced) {
  return {
    set_number: setNumber,
    score_a:    scoreA,
    score_b:    scoreB,
    winner:     winnerIdStr,
    is_deuce:   isDeuced,
  };
}

// ─── MATCH BUILDER ────────────────────────────────────────────────────────────

/**
 * plan: array of { targetA, targetB } per set.
 * The set winner is whoever reaches their target first.
 */
function buildMatchAnalyticsData(playerAId, playerBId, plan) {
  const allPoints = [];
  const allSets   = [];

  for (let i = 0; i < plan.length; i++) {
    const setNumber = i + 1;
    const { targetA, targetB } = plan[i];
    const { points, finalA, finalB } = makePoints(setNumber, targetA, targetB, playerAId, playerBId);

    const setWinner = finalA > finalB ? playerAId : playerBId;
    const isDeuced  = Math.abs(finalA - finalB) === 2 && Math.max(finalA, finalB) >= 20;

    allSets.push(makeSetRecord(setNumber, finalA, finalB, setWinner, isDeuced));
    allPoints.push(...points);
  }

  return { points: allPoints, sets: allSets };
}

function matchWinner(sets, playerAId, playerBId) {
  const winsA = sets.filter(s => s.winner === playerAId).length;
  const winsB = sets.filter(s => s.winner === playerBId).length;
  return winsA > winsB ? playerAId : playerBId;
}

function scoreSummary(sets) {
  return sets.map(s => `${s.score_a}-${s.score_b}`).join(', ');
}

// ─── SEED ─────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);

  // 1. Upsert seed players
  const pwHash = await bcrypt.hash('Seed@1234', 10);

  const [playerA, playerB] = await Promise.all([
    User.findOneAndUpdate(
      { email: 'seed.arjun@centrepitch.dev' },
      {
        $setOnInsert: {
          firstName: 'Arjun',
          lastName:  'Mehta',
          email:     'seed.arjun@centrepitch.dev',
          password:  pwHash,
          role:      'player',
        },
      },
      { upsert: true, new: true },
    ),
    User.findOneAndUpdate(
      { email: 'seed.priya@centrepitch.dev' },
      {
        $setOnInsert: {
          firstName: 'Priya',
          lastName:  'Nair',
          email:     'seed.priya@centrepitch.dev',
          password:  pwHash,
          role:      'player',
        },
      },
      { upsert: true, new: true },
    ),
  ]);

  console.log(`Players: ${playerA.firstName} (${playerA._id}) vs ${playerB.firstName} (${playerB._id})`);

  // 2. Upsert seed event
  let event = await Event.findOne({ name: '[SEED] GVCC Badminton Singles Open' });
  if (!event) {
    event = await Event.create({
      name:                  '[SEED] GVCC Badminton Singles Open',
      sport:                 new mongoose.Types.ObjectId(), // placeholder sport ref
      gameFormat:            'individual',
      eventType:             'badminton',
      description:           'Seed event for analytics testing.',
      startDate:             new Date('2025-01-10'),
      endDate:               new Date('2025-01-12'),
      registrationStartDate: new Date('2025-01-01'),
      registrationEndDate:   new Date('2025-01-09'),
      location: {
        venue:   'GVCC Sports Hall',
        city:    'Bengaluru',
        country: 'India',
      },
      organizer:  playerA._id,  // using playerA as organizer placeholder
      status:     'completed',
      schedule:   [{ round: 'Group Stage', matches: [] }],
    });
    console.log('Event created:', event._id);
  } else {
    console.log('Event found:', event._id);
  }

  const round = event.schedule[0];

  // 3. Define 3 matches — different scoreline patterns
  const matchPlans = [
    {
      label: 'Match 1 — Arjun wins 2-0',
      plan:  [{ targetA: 21, targetB: 15 }, { targetA: 21, targetB: 17 }],
      winner: 'A',
    },
    {
      label: 'Match 2 — Priya wins 2-1',
      plan:  [{ targetA: 18, targetB: 21 }, { targetA: 21, targetB: 19 }, { targetA: 15, targetB: 21 }],
      winner: 'B',
    },
    {
      label: 'Match 3 — Arjun wins 2-1',
      plan:  [{ targetA: 21, targetB: 16 }, { targetA: 17, targetB: 21 }, { targetA: 21, targetB: 18 }],
      winner: 'A',
    },
  ];

  for (const { label, plan } of matchPlans) {
    console.log(`\n--- ${label} ---`);

    const aId = String(playerA._id);
    const bId = String(playerB._id);

    // Build analytics data
    const analyticsData = buildMatchAnalyticsData(aId, bId, plan);
    const winnerIdStr   = matchWinner(analyticsData.sets, aId, bId);
    const winnerId      = winnerIdStr === aId ? playerA._id : playerB._id;
    const score         = scoreSummary(analyticsData.sets);

    // Check if match already exists in schedule
    const existingMatch = round.matches.find(
      m => String(m.player1) === aId && String(m.player2) === bId
        && m.result?.score === score
    );

    let match;
    if (existingMatch) {
      match = existingMatch;
      console.log('Match already seeded, skipping DB write.');
    } else {
      // Add match to schedule
      round.matches.push({
        player1: playerA._id,
        player2: playerB._id,
        dateTime: new Date(),
        venue:   'Court 1',
        result: {
          winner: winnerId,
          score,
          status: 'completed',
        },
      });
      await event.save();
      match = round.matches[round.matches.length - 1];
      console.log(`Match added to schedule: ${match._id}, score: ${score}`);
    }

    // Upsert MatchStat for playerA with full point data in teamTotals
    await MatchStat.findOneAndUpdate(
      {
        event:                event._id,
        matchId:              match._id,
        'participant.refId':  playerA._id,
      },
      {
        $set: {
          event:       event._id,
          matchId:     match._id,
          participant: { type: 'player', refId: playerA._id, name: `${playerA.firstName} ${playerA.lastName}` },
          teamTotals:  analyticsData,
          lastUpdatedBy: playerA._id,
        },
      },
      { upsert: true },
    );

    // Upsert minimal MatchStat for playerB (no point data — A's stat carries it)
    await MatchStat.findOneAndUpdate(
      {
        event:                event._id,
        matchId:              match._id,
        'participant.refId':  playerB._id,
      },
      {
        $set: {
          event:       event._id,
          matchId:     match._id,
          participant: { type: 'player', refId: playerB._id, name: `${playerB.firstName} ${playerB.lastName}` },
          teamTotals:  {},
          lastUpdatedBy: playerA._id,
        },
      },
      { upsert: true },
    );

    console.log(`MatchStat written (${analyticsData.points.length} points, ${analyticsData.sets.length} sets)`);

    // Trigger CA-1 ingest (fire-and-forget — wait for it here so we see the result)
    await ingestMatchAnalytics(event, match);
    console.log(`CA-1 ingest triggered for MATCH_${match._id}`);
  }

  await mongoose.disconnect();
  console.log('\nSeed complete. Disconnect from MongoDB.');
}

seed().catch(async err => {
  console.error('Seed failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
