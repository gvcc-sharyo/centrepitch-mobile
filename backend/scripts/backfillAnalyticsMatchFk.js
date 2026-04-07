/**
 * Backfill centrepitch_event_id + centrepitch_match_id on CA-1 analytics_matches.
 *
 * - Derives centrepitch_match_id from legacy _id values shaped as MATCH_<24 hex ObjectId>.
 * - Resolves centrepitch_event_id by scanning CentrePitch events for that schedule match _id.
 *
 * Usage: node --env-file=.env scripts/backfillAnalyticsMatchFk.js
 *
 * Requires one Mongo URI where BOTH `events` and `analytics_matches` live.
 * If CA-1 uses a different database name than Node (see CA-1 MONGODB_URI), set
 * MONGODB_URI to that database so this script can join, or run a manual update.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Event from '../models/Event.js';

dotenv.config();

const MONGO_URI =
  process.env.MONGODB_URI || process.env.ANALYTICS_MONGODB_URI || 'mongodb://localhost:27017/centre_pitch';

const MATCH_PREFIX = /^MATCH_([a-f0-9]{24})$/i;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected:', MONGO_URI);

  const coll = mongoose.connection.db.collection('analytics_matches');
  const cursor = coll.find({
    $or: [
      { centrepitch_match_id: { $exists: false } },
      { centrepitch_event_id: { $exists: false } },
    ],
  });

  let updated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const idStr = String(doc._id || '');
    const m = idStr.match(MATCH_PREFIX);
    let matchHex = doc.centrepitch_match_id ? String(doc.centrepitch_match_id) : null;
    if (!matchHex && m) {
      matchHex = m[1];
    }

    if (!matchHex || !/^[a-f0-9]{24}$/i.test(matchHex)) {
      skipped += 1;
      continue;
    }

    let eventId = doc.centrepitch_event_id ? String(doc.centrepitch_event_id) : null;
    if (!eventId) {
      let oid;
      try {
        oid = new mongoose.Types.ObjectId(matchHex);
      } catch {
        skipped += 1;
        continue;
      }
      const ev = await Event.findOne({ 'schedule.matches._id': oid }).select('_id').lean();
      eventId = ev ? String(ev._id) : null;
    }

    const $set = { centrepitch_match_id: matchHex };
    if (eventId) {
      $set.centrepitch_event_id = eventId;
    }

    await coll.updateOne({ _id: doc._id }, { $set });
    updated += 1;
  }

  console.log(`Done. Updated ${updated} documents, skipped ${skipped}.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
