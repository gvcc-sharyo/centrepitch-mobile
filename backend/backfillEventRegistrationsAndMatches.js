import dotenv from "dotenv";
import mongoose from "mongoose";
import Event from "./models/Event.js";
import EventPlayerRegistration from "./models/EventPlayerRegistration.js";
import EventTeamRegistration from "./models/EventTeamRegistration.js";
import EventMatch from "./models/EventMatch.js";

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/sports_event_management";

const dryRun =
  process.argv.includes("--dry-run") ||
  String(process.env.DRY_RUN || "")
    .trim()
    .toLowerCase() === "true";

const limitArg = (() => {
  const idx = process.argv.findIndex((a) => a === "--limit");
  if (idx === -1) return null;
  const v = Number(process.argv[idx + 1]);
  return Number.isFinite(v) ? v : null;
})();

const pairKey = (a, b) => {
  const sa = String(a || "");
  const sb = String(b || "");
  return [sa, sb].sort().join("|");
};

const run = async () => {
  if (!mongoUri) {
    console.error("MONGODB_URI (or MONGO_URI) is required in environment variables.");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");
  if (dryRun) console.log("Running in DRY-RUN mode (no database writes)");

  const query = {};
  const cursor = Event.find(query)
    .select("_id gameFormat registeredPlayers registeredTeams schedule")
    .lean()
    .cursor();

  let processed = 0;
  let playersCreated = 0;
  let teamsCreated = 0;
  let matchesCreated = 0;

  for await (const event of cursor) {
    processed += 1;
    if (limitArg && processed > limitArg) break;

    const eventId = event._id;

    // Doubles pairGroupId assignment: keep consistent for both mirrored rows.
    const pairGroupByKey = new Map();

    const registeredPlayers = Array.isArray(event.registeredPlayers) ? event.registeredPlayers : [];
    for (const row of registeredPlayers) {
      if (!row?.player) continue;
      const playerId = row.player;
      const partnerId = row.partner || null;

      let pairGroupId = null;
      if (partnerId) {
        const key = pairKey(playerId, partnerId);
        if (!pairGroupByKey.has(key)) {
          pairGroupByKey.set(key, new mongoose.Types.ObjectId());
        }
        pairGroupId = pairGroupByKey.get(key);
      }

      const exists = await EventPlayerRegistration.findOne({ event: eventId, player: playerId })
        .select("_id")
        .lean();
      if (exists?._id) continue;

      if (!dryRun) {
        await EventPlayerRegistration.create({
          event: eventId,
          player: playerId,
          partner: partnerId,
          pairGroupId,
          registrationDate: row.registrationDate || row.createdAt || new Date(),
          paymentStatus: row.paymentStatus || "pending",
          status: row.status || "registered",
          createdBy: null,
          withdrawnAt: row.status === "withdrawn" ? (row.updatedAt || new Date()) : null,
          metadata: { source: "legacy_event_embed" },
        });
      }
      playersCreated += 1;
    }

    const registeredTeams = Array.isArray(event.registeredTeams) ? event.registeredTeams : [];
    for (const row of registeredTeams) {
      if (!row?.team) continue;
      const teamId = row.team;
      const exists = await EventTeamRegistration.findOne({ event: eventId, team: teamId })
        .select("_id")
        .lean();
      if (exists?._id) continue;

      if (!dryRun) {
        await EventTeamRegistration.create({
          event: eventId,
          team: teamId,
          registrationDate: row.registrationDate || row.createdAt || new Date(),
          paymentStatus: row.paymentStatus || "pending",
          status: row.status || "registered",
          registeredBy: null,
          withdrawnAt: row.status === "withdrawn" ? (row.updatedAt || new Date()) : null,
          metadata: { source: "legacy_event_embed" },
        });
      }
      teamsCreated += 1;
    }

    const schedule = Array.isArray(event.schedule) ? event.schedule : [];
    for (const round of schedule) {
      const roundName = String(round?.round || "").trim();
      const matches = Array.isArray(round?.matches) ? round.matches : [];
      for (const match of matches) {
        if (!match?._id) continue;
        const legacyMatchId = match._id;

        const exists = await EventMatch.findOne({
          event: eventId,
          "metadata.legacyMatchId": legacyMatchId,
        })
          .select("_id")
          .lean();
        if (exists?._id) continue;

        const isTeam = !!(match.team1 || match.team2);
        const sideA = isTeam
          ? { entityType: "team", entityId: match.team1 }
          : { entityType: "player", entityId: match.player1 };
        const sideB = isTeam
          ? { entityType: "team", entityId: match.team2 }
          : { entityType: "player", entityId: match.player2 };

        const status = match?.result?.status || "scheduled";
        const score = match?.result?.score || "";
        const winnerId = match?.result?.winner || null;
        const winnerType = winnerId ? (isTeam ? "team" : "player") : null;

        if (!dryRun) {
          await EventMatch.create({
            event: eventId,
            round: roundName || "Round 1",
            matchNumber: match.matchNumber != null ? Number(match.matchNumber) : null,
            sideA,
            sideB,
            scheduledAt: match.dateTime || null,
            venue: match.venue || "",
            status,
            result: {
              winnerType,
              winnerId,
              score,
              notes: "",
            },
            createdBy: null,
            updatedBy: null,
            metadata: { source: "legacy_event_embed", legacyMatchId },
          });
        }
        matchesCreated += 1;
      }
    }
  }

  console.log(dryRun ? "Dry-run completed:" : "Backfill completed:");
  console.log(`- Events scanned: ${processed}`);
  console.log(`- Player registrations created: ${playersCreated}`);
  console.log(`- Team registrations created: ${teamsCreated}`);
  console.log(`- Matches created: ${matchesCreated}`);

  await mongoose.disconnect();
  console.log("Disconnected.");
};

run().catch(async (error) => {
  console.error("Backfill failed:", error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // no-op
  }
  process.exit(1);
});

