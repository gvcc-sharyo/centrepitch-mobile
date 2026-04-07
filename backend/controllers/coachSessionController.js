import CoachingSession from "../models/CoachingSession.js";
import Coach from "../models/Coach.js";
import Player from "../models/Player.js";
import SportsAcademy from "../models/SportsAcademy.js";
import CoachStudentRelation from "../models/CoachStudentRelation.js";
import CoachingEnrollment from "../models/CoachingEnrollment.js";
import AttendanceRecord from "../models/AttendanceRecord.js";
import TrainingPlan from "../models/TrainingPlan.js";
import Team from "../models/Team.js";
import CoachPayoutLedger from "../models/CoachPayoutLedger.js";

/**
 * Helper: find Coach doc for the logged-in user
 */
const findCoachForUser = async (userId) => {
  return Coach.findOne({ userId });
};
const findPlayerForUser = async (userId) => {
  return Player.findOne({ user: userId });
};

const SESSION_LOCK_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const normalizeDate = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addPatternStep = (date, pattern) => {
  const d = new Date(date);
  if (pattern === "weekly") d.setDate(d.getDate() + 7);
  else if (pattern === "biweekly") d.setDate(d.getDate() + 14);
  else if (pattern === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + 1);
  return d;
};

const isCoachActiveInAcademy = (coach, academyId) => {
  if (!coach || !academyId) return false;
  return (coach.academies || []).some(
    (entry) =>
      String(entry?.academy) === String(academyId) &&
      ["APPROVED", "ACTIVE"].includes(String(entry?.status || "").toUpperCase())
  );
};

const resolvePlayerIdsFromTeam = async (teamId) => {
  const team = await Team.findById(teamId).select("members academy sport isActive");
  if (!team || !team.isActive) return { team: null, playerIds: [] };

  const directPlayerIds = (team.members || [])
    .filter((m) => String(m.status || "").toLowerCase() === "active")
    .map((m) => m.poolPlayerId)
    .filter(Boolean)
    .map((id) => String(id));

  if (directPlayerIds.length) {
    return { team, playerIds: [...new Set(directPlayerIds)] };
  }

  const activeUserIds = (team.members || [])
    .filter((m) => String(m.status || "").toLowerCase() === "active")
    .map((m) => m.player)
    .filter(Boolean)
    .map((id) => String(id));

  if (!activeUserIds.length) return { team, playerIds: [] };
  const players = await Player.find({ user: { $in: activeUserIds } }).select("_id");
  return { team, playerIds: [...new Set(players.map((p) => String(p._id)))] };
};

let attendanceIndexesEnsured = false;
const ensureAttendanceRecordIndexes = async () => {
  if (attendanceIndexesEnsured) return;
  const indexes = await AttendanceRecord.collection.indexes();
  const legacyIndex = indexes.find(
    (idx) => idx?.unique === true && idx?.key?.session === 1 && idx?.key?.player === 1
  );
  if (legacyIndex?.name) {
    await AttendanceRecord.collection.dropIndex(legacyIndex.name);
  }
  await AttendanceRecord.syncIndexes();
  attendanceIndexesEnsured = true;
};

const dateKey = (value) => {
  const d = normalizeDate(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const deriveBillingScope = ({ type = "one_on_one", teamId = null, billingScope = "" } = {}) => {
  if (billingScope && ["individual", "team", "batch"].includes(String(billingScope))) {
    return String(billingScope);
  }
  if (teamId) return "team";
  if (type === "batch" || type === "group") return "batch";
  return "individual";
};

const resolveSessionOwnerType = ({ academyId = null, ownerType = "" } = {}) => {
  if (academyId) return "academy";
  return ownerType === "academy" ? "academy" : "coach";
};

const validatePayoutRuleInput = (payoutRule = {}) => {
  if (!payoutRule || typeof payoutRule !== "object") return null;
  const rawModel = String(payoutRule.model || "").trim();
  if (!rawModel) return null;

  const allowedModels = ["revenue_share", "fixed_per_session", "fixed_per_player"];
  if (!allowedModels.includes(rawModel)) {
    return "Invalid payout rule model";
  }

  const numericValue = Number(payoutRule.value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return "Payout rule value must be a non-negative number";
  }
  if (rawModel === "revenue_share" && numericValue > 100) {
    return "Revenue share payout value cannot be more than 100";
  }
  return null;
};

const computePayoutBreakdown = (session, presentCount = 0) => {
  const unitPrice = Number(session?.pricing?.amount || 0);
  const payoutRule = session?.metadata?.payoutRuleSnapshot || {};
  const model = String(payoutRule?.model || "").toLowerCase();
  const value = Number(payoutRule?.value || 0);
  const currency = payoutRule?.currency || session?.pricing?.currency || "INR";
  const isTeamPayerSession = Boolean(session?.metadata?.assignedTeamId)
    && String(session?.metadata?.payerTypeDefault || "") === "team";
  const billableUnits = isTeamPayerSession ? 1 : Math.max(presentCount, 0);

  let grossAmount = unitPrice * billableUnits;
  let coachShare = 0;
  let academyShare = 0;
  let calculationBasis = "attendance_count";

  if (model === "fixed_per_session") {
    calculationBasis = "fixed";
    coachShare = Math.max(value, 0);
    grossAmount = Math.max(grossAmount, coachShare);
    academyShare = Math.max(grossAmount - coachShare, 0);
  } else if (model === "fixed_per_player") {
    // For team-payer sessions, treat amount as a single team invoice (not per head).
    coachShare = Math.max(value, 0) * billableUnits;
    academyShare = Math.max(grossAmount - coachShare, 0);
  } else if (model === "revenue_share") {
    const pct = Math.min(Math.max(value, 0), 100);
    coachShare = Number(((grossAmount * pct) / 100).toFixed(2));
    academyShare = Number((grossAmount - coachShare).toFixed(2));
  } else {
    coachShare = 0;
    academyShare = grossAmount;
  }

  return {
    grossAmount: Number(grossAmount.toFixed(2)),
    coachShare: Number(coachShare.toFixed(2)),
    academyShare: Number(academyShare.toFixed(2)),
    currency,
    calculationBasis,
  };
};

const upsertCoachPayoutDraft = async (session, occurrenceDate) => {
  const ownerType = resolveSessionOwnerType({
    academyId: session?.academy || null,
    ownerType: session?.ownerType || "",
  });
  if (ownerType !== "academy") return;
  if (!session?.academy || !session?.coach) return;

  const presentCount = (session.students || []).filter(
    (s) => s?.attended === true || s?.status === "completed"
  ).length;
  const payout = computePayoutBreakdown(session, presentCount);

  await CoachPayoutLedger.findOneAndUpdate(
    {
      session: session._id,
      occurrenceDate: normalizeDate(occurrenceDate || session?.schedule?.date || new Date()),
    },
    {
      $set: {
        academy: session.academy,
        coach: session.coach,
        grossAmount: payout.grossAmount,
        academyShare: payout.academyShare,
        coachShare: payout.coachShare,
        currency: payout.currency,
        calculationBasis: payout.calculationBasis,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const appendOccurrenceHistory = (session, status = "completed") => {
  if (!session?.schedule?.date) return;
  const recordDate = normalizeDate(session.schedule.date);
  const startTime = session.schedule?.startTime || "";
  const endTime = session.schedule?.endTime || "";
  const duration = session.schedule?.duration || 0;
  const existing = (session.metadata?.occurrences || []).some((o) => (
    dateKey(o?.date) === dateKey(recordDate)
    && String(o?.startTime || "") === String(startTime)
    && String(o?.endTime || "") === String(endTime)
  ));
  if (existing) return;

  const attendance = (session.students || []).reduce((acc, s) => {
    if (s.attended === true || s.status === "completed") acc.present += 1;
    else if (s.status === "absent") acc.absent += 1;
    else acc.pending += 1;
    return acc;
  }, { present: 0, absent: 0, pending: 0 });

  if (!session.metadata) session.metadata = {};
  if (!Array.isArray(session.metadata.occurrences)) session.metadata.occurrences = [];
  session.metadata.occurrences.push({
    date: recordDate,
    startTime,
    endTime,
    duration,
    status,
    presentCount: attendance.present,
    absentCount: attendance.absent,
    pendingCount: attendance.pending,
    completedAt: new Date(),
  });
};

const getNextPlanOccurrenceDate = (plan, afterDate, cycleEndDate = null) => {
  const weekdays = Array.isArray(plan?.recurrence?.weekdays) ? plan.recurrence.weekdays : [];
  const weekdayIndexes = new Set(weekdays.map((d) => WEEKDAY_MAP[String(d || "").toLowerCase()]).filter((n) => n !== undefined));
  const base = normalizeDate(afterDate);
  const cycleEnd = cycleEndDate ? normalizeDate(cycleEndDate) : null;

  if (weekdayIndexes.size > 0) {
    const cursor = addPatternStep(base, "daily");
    for (let i = 0; i < 370; i += 1) {
      const normalizedCursor = normalizeDate(cursor);
      if (cycleEnd && normalizedCursor >= cycleEnd) return null;
      if (weekdayIndexes.has(cursor.getDay())) return new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }
    return null;
  }

  const next = addPatternStep(base, plan?.recurrence?.pattern || "weekly");
  if (cycleEnd && normalizeDate(next) >= cycleEnd) return null;
  return next;
};

const autoExpireOldCoachSessions = async (coachId) => {
  const lockThreshold = normalizeDate(new Date(Date.now() - SESSION_LOCK_DAYS * DAY_MS));
  await CoachingSession.updateMany(
    {
      coach: coachId,
      status: { $in: ["scheduled", "in_progress"] },
      "schedule.date": { $lt: lockThreshold },
    },
    {
      $set: {
        status: "cancelled",
        cancellationReason: "Auto-expired after 7 days",
      },
    }
  );
};

const isAcademyPaidSession = (session) => {
  const ownerType = String(session?.ownerType || "").toLowerCase();
  const pricingType = String(session?.pricing?.type || "").toLowerCase();
  const amount = Number(session?.pricing?.amount || 0);
  return ownerType === "academy" && pricingType !== "free" && amount > 0;
};

const getLatestEnrollmentByPlayerForSession = async (sessionId, playerIds = []) => {
  if (!sessionId || !Array.isArray(playerIds) || playerIds.length === 0) {
    return {};
  }
  const rows = await CoachingEnrollment.find({
    session: sessionId,
    player: { $in: playerIds },
  })
    .select("player paymentStatus status createdAt")
    .sort({ createdAt: -1 })
    .lean();

  return rows.reduce((acc, row) => {
    const key = String(row.player || "");
    if (!key) return acc;
    if (!acc[key]) acc[key] = row;
    return acc;
  }, {});
};

const getUnpaidPlayersForAcademySession = async (session) => {
  if (!isAcademyPaidSession(session)) return [];
  const playerIds = [...new Set(
    (session?.students || [])
      .map((s) => s?.player?._id || s?.player)
      .filter(Boolean)
      .map((id) => String(id))
  )];
  if (!playerIds.length) return [];

  const enrollmentByPlayer = await getLatestEnrollmentByPlayerForSession(session._id, playerIds);
  const unpaidPlayerIds = playerIds.filter((playerId) => {
    const enrollment = enrollmentByPlayer[playerId];
    return String(enrollment?.paymentStatus || "").toUpperCase() !== "PAID";
  });
  if (!unpaidPlayerIds.length) return [];

  const players = await Player.find({ _id: { $in: unpaidPlayerIds } })
    .select("name firstName lastName")
    .lean();
  const labelById = players.reduce((acc, player) => {
    const fullName = [player?.firstName, player?.lastName].filter(Boolean).join(" ").trim();
    acc[String(player?._id || "")] = fullName || player?.name || "Player";
    return acc;
  }, {});

  return unpaidPlayerIds.map((id) => ({
    playerId: id,
    label: labelById[id] || "Player",
  }));
};

const assertAcademySessionPaymentsComplete = async (session) => {
  const unpaidPlayers = await getUnpaidPlayersForAcademySession(session);
  if (!unpaidPlayers.length) {
    return { ok: true, unpaidPlayers: [] };
  }

  const preview = unpaidPlayers.slice(0, 3).map((p) => p.label).join(", ");
  const more = unpaidPlayers.length > 3 ? ` and ${unpaidPlayers.length - 3} more` : "";
  return {
    ok: false,
    unpaidPlayers,
    message: `Session cannot proceed until all assigned players complete payment. Pending: ${preview}${more}.`,
  };
};

const assertAcademySessionHasAtLeastOnePaidPlayer = async (session) => {
  if (!isAcademyPaidSession(session)) return { ok: true };
  const playerIds = [...new Set(
    (session?.students || [])
      .map((s) => s?.player?._id || s?.player)
      .filter(Boolean)
      .map((id) => String(id))
  )];
  if (!playerIds.length) {
    return {
      ok: false,
      message: "Session cannot start until at least one assigned player has paid.",
    };
  }
  const enrollmentByPlayer = await getLatestEnrollmentByPlayerForSession(session._id, playerIds);
  const paidCount = playerIds.filter(
    (playerId) => String(enrollmentByPlayer[playerId]?.paymentStatus || "").toUpperCase() === "PAID"
  ).length;
  if (paidCount > 0) return { ok: true, paidCount };
  return {
    ok: false,
    message: "Session cannot start until at least one assigned player has paid.",
  };
};

// ============================================================
// COACH endpoints
// ============================================================

/**
 * @desc    Create a new coaching session
 * @route   POST /api/coaching-sessions
 * @access  Private (Coach)
 */
export const createSession = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const {
      sport, title, description, type, schedule,
      maxStudents, pricing, court, location, studentIds, academy, trainingPlanId, ownerType, billingScope, payoutRule,
    } = req.body;

    if (!sport || !title || !schedule?.date || !schedule?.startTime || !schedule?.endTime) {
      return res.status(400).json({ success: false, message: "Sport, title, date, start/end time are required" });
    }

    if (academy) {
      const academyDoc = await SportsAcademy.findById(academy).select("_id status");
      if (!academyDoc || academyDoc.status !== "APPROVED") {
        return res.status(400).json({
          success: false,
          message: "Selected academy is invalid or not approved",
        });
      }
      if (!isCoachActiveInAcademy(coach, academyDoc._id)) {
        return res.status(403).json({
          success: false,
          message: "You are not an active member of this academy",
        });
      }
    }

    const resolvedOwnerType = resolveSessionOwnerType({ academyId: academy || null, ownerType });
    const resolvedBillingScope = deriveBillingScope({
      type: type || "one_on_one",
      teamId: null,
      billingScope,
    });
    const payoutRuleError = validatePayoutRuleInput(payoutRule);
    if (payoutRuleError) {
      return res.status(400).json({ success: false, message: payoutRuleError });
    }
    if (resolvedOwnerType === "academy" && !academy) {
      return res.status(400).json({
        success: false,
        message: "Academy-owned session requires a valid academy id",
      });
    }
    if (resolvedOwnerType !== "academy" && payoutRule?.model) {
      return res.status(400).json({
        success: false,
        message: "Payout rule is allowed only for academy-owned sessions",
      });
    }
    if (resolvedBillingScope === "team") {
      return res.status(400).json({
        success: false,
        message: "Team billing scope is only supported for academy team sessions",
      });
    }

    const students = (studentIds || []).map((pid) => ({
      player: pid,
      status: "enrolled",
      enrolledAt: new Date(),
    }));

    // For one-on-one flow, keep one session per coach+player+sport
    // and update its schedule/details instead of creating duplicates.
    if ((type || "one_on_one") === "one_on_one" && (studentIds || []).length === 1) {
      const playerId = studentIds[0];
      const existingOneOnOne = await CoachingSession.findOne({
        coach: coach._id,
        sport,
        type: "one_on_one",
        status: { $in: ["scheduled", "in_progress", "completed"] },
        "students.player": playerId,
      });

      if (existingOneOnOne) {
        existingOneOnOne.title = title.trim();
        existingOneOnOne.description = description || "";
        existingOneOnOne.schedule = {
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          duration: schedule.duration || 60,
          recurring: schedule.recurring || false,
          recurrencePattern: schedule.recurrencePattern || "",
        };
        existingOneOnOne.maxStudents = 1;
        existingOneOnOne.pricing = pricing || { amount: 0, currency: "INR", type: "free" };
        existingOneOnOne.court = court || null;
        existingOneOnOne.location = location || "";
        existingOneOnOne.academy = academy || null;
        existingOneOnOne.ownerType = resolvedOwnerType;
        existingOneOnOne.billingScope = resolvedBillingScope;
        existingOneOnOne.metadata = {
          ...(existingOneOnOne.metadata || {}),
          trainingPlanId: trainingPlanId || existingOneOnOne.metadata?.trainingPlanId || null,
          payoutRuleSnapshot: {
            model: payoutRule?.model || existingOneOnOne.metadata?.payoutRuleSnapshot?.model || "",
            value: Number(payoutRule?.value ?? existingOneOnOne.metadata?.payoutRuleSnapshot?.value ?? 0),
            currency: payoutRule?.currency || existingOneOnOne.metadata?.payoutRuleSnapshot?.currency || pricing?.currency || "INR",
          },
        };
        existingOneOnOne.status = "scheduled";
        existingOneOnOne.cancellationReason = "";

        // Reset per-session attendee state for the new run.
        existingOneOnOne.students = [
          {
            player: playerId,
            status: "enrolled",
            attended: false,
            enrolledAt: new Date(),
            feedback: "",
            rating: null,
          },
        ];

        await existingOneOnOne.save();
        await existingOneOnOne.populate("sport", "name slug");
        await existingOneOnOne.populate("students.player", "name email phone photo");

        return res.status(200).json({
          success: true,
          message: "Existing session rescheduled for this player",
          data: existingOneOnOne,
        });
      }
    }

    const session = await CoachingSession.create({
      coach: coach._id,
      academy: academy || null,
      sport,
      title: title.trim(),
      description: description || "",
      type: type || "one_on_one",
      ownerType: resolvedOwnerType,
      billingScope: resolvedBillingScope,
      schedule: {
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        duration: schedule.duration || 60,
        recurring: schedule.recurring || false,
        recurrencePattern: schedule.recurrencePattern || "",
      },
      maxStudents: maxStudents || (type === "one_on_one" ? 1 : 20),
      students,
      pricing: pricing || { amount: 0, currency: "INR", type: "free" },
      court: court || null,
      location: location || "",
      createdBy: req.user._id,
      metadata: {
        trainingPlanId: trainingPlanId || null,
        payoutRuleSnapshot: {
          model: payoutRule?.model || "",
          value: Number(payoutRule?.value || 0),
          currency: payoutRule?.currency || pricing?.currency || "INR",
        },
      },
    });

    await session.populate("sport", "name slug");
    await session.populate("students.player", "name email phone photo");

    res.status(201).json({ success: true, message: "Session created", data: session });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({ success: false, message: "Error creating session", error: error.message });
  }
};

/**
 * @desc    Get all sessions for the logged-in coach
 * @route   GET /api/coaching-sessions/my
 * @access  Private (Coach)
 */
export const getMySessions = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const { status, sport, page = 1, limit = 50 } = req.query;
    await autoExpireOldCoachSessions(coach._id);
    const query = { coach: coach._id };
    if (status) query.status = status;
    if (sport) query.sport = sport;

    const total = await CoachingSession.countDocuments(query);
    const sessions = await CoachingSession.find(query)
      .populate("sport", "name slug")
      .populate("students.player", "name email phone photo")
      .populate("academy", "name logo")
      .populate("metadata.assignedTeamId", "name sport")
      .sort({ "schedule.date": -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const sessionIds = sessions.map((s) => s._id);
    const paymentAgg = sessionIds.length
      ? await CoachingEnrollment.aggregate([
          { $match: { session: { $in: sessionIds } } },
          {
            $group: {
              _id: "$session",
              paidCount: {
                $sum: {
                  $cond: [{ $eq: ["$paymentStatus", "PAID"] }, 1, 0],
                },
              },
              pendingCount: {
                $sum: {
                  $cond: [{ $ne: ["$paymentStatus", "PAID"] }, 1, 0],
                },
              },
              trialActiveCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$isTrial", true] },
                        { $ne: ["$paymentStatus", "PAID"] },
                        { $eq: ["$status", "ACTIVE"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
      : [];

    const paymentBySession = paymentAgg.reduce((acc, item) => {
      acc[item._id.toString()] = {
        paidCount: item.paidCount || 0,
        pendingCount: item.pendingCount || 0,
        trialActiveCount: item.trialActiveCount || 0,
      };
      return acc;
    }, {});

    const enrollments = sessionIds.length
      ? await CoachingEnrollment.find({ session: { $in: sessionIds } })
          .select("session player paymentStatus status isTrial trialEndsAt pricingSnapshot createdAt")
          .sort({ createdAt: -1 })
      : [];
    const payoutRows = sessionIds.length
      ? await CoachPayoutLedger.find({ session: { $in: sessionIds } })
          .select("session occurrenceDate status coachShare currency paidAt createdAt")
          .sort({ occurrenceDate: -1, createdAt: -1 })
          .lean()
      : [];

    const paymentByPlayerSession = enrollments.reduce((acc, enrollment) => {
      const sessionKey = String(enrollment.session);
      const playerKey = String(enrollment.player);
      if (!acc[sessionKey]) acc[sessionKey] = {};
      if (!acc[sessionKey][playerKey]) {
        acc[sessionKey][playerKey] = {
          playerId: enrollment.player,
          paymentStatus: enrollment.paymentStatus,
          enrollmentStatus: enrollment.status,
          isTrial: !!enrollment.isTrial,
          trialEndsAt: enrollment.trialEndsAt || null,
          amount: enrollment.pricingSnapshot?.amount || 0,
          currency: enrollment.pricingSnapshot?.currency || "INR",
        };
      }
      return acc;
    }, {});
    const payoutRowsBySession = payoutRows.reduce((acc, row) => {
      const key = String(row.session);
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});

    const sessionsWithSummary = sessions.map((session) => {
      const summary = paymentBySession[session._id.toString()] || {
        paidCount: 0,
        pendingCount: 0,
        trialActiveCount: 0,
      };
      const sessionPayoutRows = payoutRowsBySession[session._id.toString()] || [];
      const sessionDate = normalizeDate(session.schedule?.date || new Date());
      const exactOccurrenceRow = sessionPayoutRows.find(
        (row) => dateKey(row?.occurrenceDate || row?.createdAt || new Date()) === dateKey(sessionDate)
      );
      const payoutRow = exactOccurrenceRow || sessionPayoutRows[0] || null;
      const paymentByPlayer = Object.values(paymentByPlayerSession[session._id.toString()] || {});
      return {
        ...session.toObject(),
        paymentSummary: summary,
        paymentByPlayer,
        payoutSummary: payoutRow
          ? {
              status: payoutRow.status || "pending",
              coachShare: Number(payoutRow.coachShare || 0),
              currency: payoutRow.currency || "INR",
              paidAt: payoutRow.paidAt || null,
            }
          : null,
      };
    });

    res.json({ success: true, data: sessionsWithSummary, total, page: parseInt(page) });
  } catch (error) {
    console.error("Get my sessions error:", error);
    res.status(500).json({ success: false, message: "Error fetching sessions" });
  }
};

/**
 * @desc    Get a single session by ID
 * @route   GET /api/coaching-sessions/:id
 * @access  Private (Coach or enrolled Player)
 */
export const getSessionById = async (req, res) => {
  try {
    const session = await CoachingSession.findById(req.params.id)
      .populate("coach", "firstName lastName email profilePhoto specialization")
      .populate("sport", "name slug")
      .populate("students.player", "name email phone photo gender dateOfBirth sports")
      .populate("academy", "name logo")
      .populate("metadata.assignedTeamId", "name sport")
      .populate("metadata.playerCheckIns.player", "name email")
      .populate("court", "name");

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const enrollments = await CoachingEnrollment.find({ session: session._id })
      .populate("player", "name email")
      .select("player paymentStatus status isTrial trialEndsAt pricingSnapshot");

    const paymentSummary = enrollments.reduce(
      (acc, e) => {
        if (e.paymentStatus === "PAID") acc.paidCount += 1;
        else acc.pendingCount += 1;

        if (e.isTrial && e.paymentStatus !== "PAID" && e.status === "ACTIVE") {
          acc.trialActiveCount += 1;
        }
        return acc;
      },
      { paidCount: 0, pendingCount: 0, trialActiveCount: 0 }
    );

    const paymentByPlayer = enrollments.map((e) => ({
      playerId: e.player?._id || null,
      playerName: e.player?.name || "",
      playerEmail: e.player?.email || "",
      paymentStatus: e.paymentStatus,
      enrollmentStatus: e.status,
      isTrial: !!e.isTrial,
      trialEndsAt: e.trialEndsAt || null,
      amount: e.pricingSnapshot?.amount || 0,
      currency: e.pricingSnapshot?.currency || "INR",
    }));
    const joinRequests = enrollments
      .filter((e) => e.status === "REQUESTED")
      .map((e) => ({
        enrollmentId: e._id,
        playerId: e.player?._id || null,
        playerName: e.player?.name || "",
        playerEmail: e.player?.email || "",
        amount: e.pricingSnapshot?.amount || 0,
        currency: e.pricingSnapshot?.currency || "INR",
      }));
    const checkInRequests = (session.metadata?.playerCheckIns || [])
      .filter((entry) => entry?.status === "pending")
      .map((entry) => ({
        checkInId: entry._id,
        playerId: entry.player?._id || entry.player || null,
        playerName: entry.player?.name || "",
        playerEmail: entry.player?.email || "",
        occurrenceDate: entry.occurrenceDate || session.schedule?.date || null,
        requestedAt: entry.requestedAt || null,
      }))
      .sort((a, b) => new Date(a.occurrenceDate || 0) - new Date(b.occurrenceDate || 0));
    const attendanceRecords = await AttendanceRecord.find({ session: session._id })
      .populate("player", "name email")
      .select("player status occurrenceDate markedAt")
      .sort({ occurrenceDate: -1, markedAt: -1 })
      .lean();
    const attendanceByDateMap = attendanceRecords.reduce((acc, row) => {
      const key = dateKey(row.occurrenceDate || row.markedAt || new Date());
      if (!acc[key]) {
        acc[key] = {
          date: row.occurrenceDate || row.markedAt || new Date(),
          total: 0,
          present: 0,
          absent: 0,
          excused: 0,
          players: [],
        };
      }
      acc[key].total += 1;
      if (row.status === "present" || row.status === "late") acc[key].present += 1;
      else if (row.status === "absent") acc[key].absent += 1;
      else acc[key].excused += 1;
      acc[key].players.push({
        playerId: row.player?._id || null,
        playerName: row.player?.name || "",
        playerEmail: row.player?.email || "",
        status: row.status,
      });
      return acc;
    }, {});
    const attendanceByDate = Object.values(attendanceByDateMap)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      data: {
        ...session.toObject(),
        paymentSummary,
        paymentByPlayer,
        joinRequests,
        checkInRequests,
        attendanceByDate,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching session" });
  }
};

/**
 * @desc    Update a session
 * @route   PUT /api/coaching-sessions/:id
 * @access  Private (Coach who owns it)
 */
export const updateSession = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const session = await CoachingSession.findOne({ _id: req.params.id, coach: coach._id });
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const {
      title, description, type, schedule, maxStudents,
      pricing, court, location, status, notes, studentIds, addStudentIds, removeStudentIds, replaceStudentIds,
    } = req.body;

    const sessionDate = normalizeDate(session.schedule?.date || new Date());
    const isLocked = Date.now() - sessionDate.getTime() > SESSION_LOCK_DAYS * DAY_MS;
    if (isLocked) {
      return res.status(400).json({
        success: false,
        message: "Session is locked after 7 days and can no longer be edited",
      });
    }

    if (title !== undefined) session.title = title.trim();
    if (description !== undefined) session.description = description;
    if (type !== undefined) session.type = type;
    if (schedule !== undefined) {
      if (schedule.date !== undefined) session.schedule.date = schedule.date;
      if (schedule.startTime !== undefined) session.schedule.startTime = schedule.startTime;
      if (schedule.endTime !== undefined) session.schedule.endTime = schedule.endTime;
      if (schedule.duration !== undefined) session.schedule.duration = schedule.duration;
      if (schedule.recurring !== undefined) session.schedule.recurring = schedule.recurring;
      if (schedule.recurrencePattern !== undefined) session.schedule.recurrencePattern = schedule.recurrencePattern;
    }
    if (maxStudents !== undefined) session.maxStudents = maxStudents;
    if (pricing !== undefined) session.pricing = pricing;
    if (court !== undefined) session.court = court || null;
    if (location !== undefined) session.location = location;
    if (notes !== undefined) session.notes = notes;

    if (status !== undefined) {
      if (String(status) === "in_progress") {
        const minimumPaidGate = await assertAcademySessionHasAtLeastOnePaidPlayer(session);
        if (!minimumPaidGate.ok) {
          return res.status(403).json({
            success: false,
            message: minimumPaidGate.message,
            code: "SESSION_MIN_PAYMENT_REQUIRED",
          });
        }
      }
      if (String(status) === "completed") {
        const paymentGate = await assertAcademySessionPaymentsComplete(session);
        if (!paymentGate.ok) {
          return res.status(403).json({
            success: false,
            message: paymentGate.message,
            code: "SESSION_PAYMENT_PENDING",
            data: { unpaidPlayers: paymentGate.unpaidPlayers },
          });
        }
      }
      session.status = status;
      if (status === "completed") {
        session.students.forEach((s) => {
          if (s.status === "enrolled") {
            s.status = "completed";
            s.attended = true;
          }
        });
        coach.totalSessionsConducted = (coach.totalSessionsConducted || 0) + 1;
        await coach.save();

        await CoachStudentRelation.updateMany(
          {
            coach: coach._id,
            player: { $in: session.students.filter(s => s.attended).map(s => s.player) },
          },
          { $inc: { sessionsCompleted: 1 }, lastSessionAt: new Date() }
        );

        appendOccurrenceHistory(session, "completed");
      }
    }

    if (studentIds !== undefined) {
      const existingIds = session.students.map((s) => s.player.toString());
      const newIds = studentIds.filter((id) => !existingIds.includes(id));
      newIds.forEach((pid) => {
        session.students.push({ player: pid, status: "enrolled", enrolledAt: new Date() });
      });
    }

    if (Array.isArray(replaceStudentIds)) {
      const uniqueIds = [...new Set(replaceStudentIds.map((id) => String(id)))];
      const existingMap = new Map(session.students.map((s) => [String(s.player), s]));
      const cappedIds = uniqueIds.slice(0, Math.max(parseInt(session.maxStudents, 10) || 1, 1));
      session.students = cappedIds.map((pid) => {
        const existingStudent = existingMap.get(pid);
        if (existingStudent) return existingStudent;
        return { player: pid, status: "enrolled", attended: false, enrolledAt: new Date() };
      });
    } else {
      if (Array.isArray(removeStudentIds) && removeStudentIds.length) {
        const toRemove = new Set(removeStudentIds.map((id) => String(id)));
        session.students = session.students.filter((s) => !toRemove.has(String(s.player)));
      }
      if (Array.isArray(addStudentIds) && addStudentIds.length) {
        const existingIds = new Set(session.students.map((s) => String(s.player)));
        const slotsLeft = Math.max((session.maxStudents || 1) - existingIds.size, 0);
        const uniqueAdds = [...new Set(addStudentIds.map((id) => String(id)))].filter((id) => !existingIds.has(id));
        uniqueAdds.slice(0, slotsLeft).forEach((pid) => {
          session.students.push({ player: pid, status: "enrolled", attended: false, enrolledAt: new Date() });
        });
      }
    }

    let rolledForward = false;
    const shouldRollForwardFromPlan = status === "completed" && session.metadata?.trainingPlanId;
    if (shouldRollForwardFromPlan) {
      const plan = await TrainingPlan.findOne({
        _id: session.metadata.trainingPlanId,
        coach: coach._id,
        status: "active",
      });
      if (plan?.recurrence?.enabled) {
        const nextDate = getNextPlanOccurrenceDate(
          plan,
          session.schedule?.date || new Date(),
          session.metadata?.occurrenceCycleEndDate || null
        );
        if (nextDate) {
          session.schedule.date = normalizeDate(nextDate);
          session.schedule.startTime = plan.scheduleTemplate?.startTime || session.schedule.startTime;
          session.schedule.endTime = plan.scheduleTemplate?.endTime || session.schedule.endTime;
          session.schedule.duration = plan.scheduleTemplate?.duration || session.schedule.duration || 60;
          session.schedule.recurring = true;
          session.schedule.recurrencePattern = plan.recurrence?.pattern || session.schedule.recurrencePattern || "weekly";
          session.status = "scheduled";
          session.cancellationReason = "";

          session.students.forEach((s) => {
            s.status = "enrolled";
            s.attended = false;
            s.feedback = "";
            s.rating = null;
          });

          rolledForward = true;
        }
      }
    }

    await session.save();
    await session.populate("sport", "name slug");
    await session.populate("students.player", "name email phone photo");

    res.json({
      success: true,
      message: "Session updated",
      data: session,
      rolledForward,
    });
  } catch (error) {
    console.error("Update session error:", error);
    res.status(500).json({ success: false, message: "Error updating session", error: error.message });
  }
};

/**
 * @desc    Delete (cancel) a session
 * @route   DELETE /api/coaching-sessions/:id
 * @access  Private (Coach)
 */
export const deleteSession = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const session = await CoachingSession.findOne({ _id: req.params.id, coach: coach._id });
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    session.status = "cancelled";
    session.cancellationReason = req.body.reason || "Cancelled by coach";
    await session.save();

    res.json({ success: true, message: "Session cancelled" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error cancelling session" });
  }
};

/**
 * @desc    Mark attendance for a session
 * @route   PUT /api/coaching-sessions/:id/attendance
 * @access  Private (Coach)
 */
export const markAttendance = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const session = await CoachingSession.findOne({ _id: req.params.id, coach: coach._id });
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const paymentGate = await assertAcademySessionPaymentsComplete(session);
    if (!paymentGate.ok) {
      return res.status(403).json({
        success: false,
        message: paymentGate.message,
        code: "SESSION_PAYMENT_PENDING",
        data: { unpaidPlayers: paymentGate.unpaidPlayers },
      });
    }

    const { attendance } = req.body;
    if (!Array.isArray(attendance)) {
      return res.status(400).json({ success: false, message: "attendance array is required" });
    }

    await ensureAttendanceRecordIndexes();

    const occurrenceDate = normalizeDate(session.schedule?.date || new Date());
    const attendancePlayerIds = [...new Set(
      attendance
        .map((entry) => String(entry?.playerId || ""))
        .filter(Boolean)
    )];
    const enrollmentRows = attendancePlayerIds.length
      ? await CoachingEnrollment.find({
          session: session._id,
          player: { $in: attendancePlayerIds },
        })
          .select("_id player createdAt")
          .sort({ createdAt: -1 })
      : [];
    const enrollmentByPlayer = enrollmentRows.reduce((acc, row) => {
      const key = String(row.player);
      if (!acc[key]) acc[key] = row._id;
      return acc;
    }, {});

    attendance.forEach(({ playerId, present }) => {
      const student = session.students.find((s) => s.player.toString() === playerId);
      if (student) {
        student.attended = present;
        student.status = present ? "completed" : "absent";
      }
    });

    await session.save();
    await session.populate("students.player", "name email phone photo");

    // Persist normalized attendance records for reporting.
    await Promise.all(
      attendance.map(async ({ playerId, present }) => {
        await AttendanceRecord.findOneAndUpdate(
          { session: session._id, player: playerId, occurrenceDate },
          {
            $set: {
              enrollment: enrollmentByPlayer[String(playerId)] || null,
              plan: session.metadata?.trainingPlanId || null,
              academy: session.academy || null,
              coach: coach._id,
              team: session.metadata?.assignedTeamId || null,
              ownerType: resolveSessionOwnerType({
                academyId: session.academy || null,
                ownerType: session.ownerType || "",
              }),
              occurrenceDate,
              status: present ? "present" : "absent",
              markedBy: req.user._id,
              markedAt: new Date(),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      })
    );
    await upsertCoachPayoutDraft(session, occurrenceDate);

    res.json({ success: true, message: "Attendance updated", data: session });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(500).json({
        success: false,
        message: "Attendance index conflict detected. Please retry once; migration will be applied automatically.",
      });
    }
    res.status(500).json({ success: false, message: "Error updating attendance" });
  }
};

/**
 * @desc    Player requests attendance check-in for a session occurrence
 * @route   POST /api/coaching-sessions/:id/player-checkin
 * @access  Private (Player)
 */
export const requestPlayerCheckIn = async (req, res) => {
  try {
    const player = await findPlayerForUser(req.user._id);
    if (!player) {
      return res.status(404).json({ success: false, message: "Player profile not found" });
    }

    const session = await CoachingSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }
    if (!["scheduled", "in_progress"].includes(session.status)) {
      return res.status(400).json({ success: false, message: "Check-in is allowed only for active sessions" });
    }

    const isAssigned = (session.students || []).some((s) => String(s.player) === String(player._id));
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: "You are not assigned to this session" });
    }

    if (isAcademyPaidSession(session)) {
      const latestEnrollment = await CoachingEnrollment.findOne({
        session: session._id,
        player: player._id,
      })
        .select("paymentStatus status createdAt")
        .sort({ createdAt: -1 });
      if (String(latestEnrollment?.paymentStatus || "").toUpperCase() !== "PAID") {
        return res.status(403).json({
          success: false,
          message: "Please complete session payment first. Attendance check-in is available only after payment.",
          code: "PLAYER_PAYMENT_REQUIRED",
        });
      }
    }

    const occurrenceDate = normalizeDate(session.schedule?.date || new Date());
    if (!session.metadata) session.metadata = {};
    if (!Array.isArray(session.metadata.playerCheckIns)) session.metadata.playerCheckIns = [];

    const existingForDay = session.metadata.playerCheckIns.find(
      (entry) =>
        String(entry.player) === String(player._id) &&
        dateKey(entry.occurrenceDate || occurrenceDate) === dateKey(occurrenceDate)
    );

    if (existingForDay?.status === "pending") {
      return res.status(409).json({ success: false, message: "Check-in request already pending" });
    }
    if (existingForDay?.status === "approved") {
      return res.status(409).json({ success: false, message: "Attendance already approved for this session day" });
    }

    if (existingForDay?.status === "rejected") {
      existingForDay.status = "pending";
      existingForDay.requestedAt = new Date();
      existingForDay.decidedAt = null;
      existingForDay.decidedBy = null;
      existingForDay.notes = "";
    } else {
      session.metadata.playerCheckIns.push({
        player: player._id,
        occurrenceDate,
        status: "pending",
        requestedAt: new Date(),
      });
    }

    await session.save();
    return res.json({ success: true, message: "Check-in request sent to coach" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error creating check-in request" });
  }
};

/**
 * @desc    Coach approves a player's check-in request
 * @route   PUT /api/coaching-sessions/:id/player-checkin/:playerId/approve
 * @access  Private (Coach)
 */
export const approvePlayerCheckIn = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const session = await CoachingSession.findOne({ _id: req.params.id, coach: coach._id });
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const paymentGate = await assertAcademySessionPaymentsComplete(session);
    if (!paymentGate.ok) {
      return res.status(403).json({
        success: false,
        message: paymentGate.message,
        code: "SESSION_PAYMENT_PENDING",
        data: { unpaidPlayers: paymentGate.unpaidPlayers },
      });
    }

    const playerId = String(req.params.playerId || "");
    if (!playerId) {
      return res.status(400).json({ success: false, message: "playerId is required" });
    }

    const occurrenceDate = normalizeDate(req.body?.occurrenceDate || session.schedule?.date || new Date());
    const latestEnrollment = await CoachingEnrollment.findOne({
      session: session._id,
      player: playerId,
    })
      .select("_id")
      .sort({ createdAt: -1 });
    const checkInEntry = (session.metadata?.playerCheckIns || []).find(
      (entry) =>
        String(entry.player) === playerId &&
        dateKey(entry.occurrenceDate || occurrenceDate) === dateKey(occurrenceDate) &&
        entry.status === "pending"
    );
    if (!checkInEntry) {
      return res.status(404).json({ success: false, message: "Pending check-in request not found" });
    }

    const student = (session.students || []).find((s) => String(s.player) === playerId);
    if (student) {
      student.attended = true;
      student.status = "completed";
    }

    checkInEntry.status = "approved";
    checkInEntry.decidedAt = new Date();
    checkInEntry.decidedBy = req.user._id;
    checkInEntry.notes = String(req.body?.notes || "");

    await ensureAttendanceRecordIndexes();
    await AttendanceRecord.findOneAndUpdate(
      { session: session._id, player: playerId, occurrenceDate },
      {
        $set: {
          enrollment: latestEnrollment?._id || null,
          plan: session.metadata?.trainingPlanId || null,
          academy: session.academy || null,
          coach: coach._id,
          team: session.metadata?.assignedTeamId || null,
          ownerType: resolveSessionOwnerType({
            academyId: session.academy || null,
            ownerType: session.ownerType || "",
          }),
          occurrenceDate,
          status: "present",
          markedBy: req.user._id,
          markedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await session.save();
    await upsertCoachPayoutDraft(session, occurrenceDate);
    await session.populate("students.player", "name email phone photo");

    return res.json({ success: true, message: "Check-in approved", data: session });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error approving check-in" });
  }
};

/**
 * @desc    Coach rejects a player's check-in request
 * @route   PUT /api/coaching-sessions/:id/player-checkin/:playerId/reject
 * @access  Private (Coach)
 */
export const rejectPlayerCheckIn = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const session = await CoachingSession.findOne({ _id: req.params.id, coach: coach._id });
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const playerId = String(req.params.playerId || "");
    if (!playerId) {
      return res.status(400).json({ success: false, message: "playerId is required" });
    }

    const occurrenceDate = normalizeDate(req.body?.occurrenceDate || session.schedule?.date || new Date());
    const checkInEntry = (session.metadata?.playerCheckIns || []).find(
      (entry) =>
        String(entry.player) === playerId &&
        dateKey(entry.occurrenceDate || occurrenceDate) === dateKey(occurrenceDate) &&
        entry.status === "pending"
    );
    if (!checkInEntry) {
      return res.status(404).json({ success: false, message: "Pending check-in request not found" });
    }

    checkInEntry.status = "rejected";
    checkInEntry.decidedAt = new Date();
    checkInEntry.decidedBy = req.user._id;
    checkInEntry.notes = String(req.body?.notes || "");

    await session.save();
    return res.json({ success: true, message: "Check-in rejected" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error rejecting check-in" });
  }
};

/**
 * @desc    Get overall attendance summary for coach
 * @route   GET /api/coaching-sessions/coach/attendance-summary
 * @access  Private (Coach)
 */
export const getCoachAttendanceSummary = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const { startDate, endDate } = req.query;
    const match = { coach: coach._id };
    if (startDate || endDate) {
      match.occurrenceDate = {};
      if (startDate) match.occurrenceDate.$gte = normalizeDate(startDate);
      if (endDate) match.occurrenceDate.$lte = normalizeDate(endDate);
    }

    const records = await AttendanceRecord.find(match).lean();
    const summary = records.reduce(
      (acc, r) => {
        acc.total += 1;
        if (r.status === "present" || r.status === "late") acc.present += 1;
        else if (r.status === "absent") acc.absent += 1;
        else acc.excused += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0, excused: 0 }
    );

    const attendancePercent = summary.total > 0
      ? Number(((summary.present / summary.total) * 100).toFixed(2))
      : 0;

    return res.json({
      success: true,
      data: {
        ...summary,
        attendancePercent,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching attendance summary" });
  }
};

/**
 * @desc    Get session-wise attendance summary for coach
 * @route   GET /api/coaching-sessions/coach/attendance-by-session
 * @access  Private (Coach)
 */
export const getCoachSessionWiseAttendance = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const sessions = await CoachingSession.find({ coach: coach._id }).select("title").lean();
    const sessionTitleMap = sessions.reduce((acc, s) => {
      acc[String(s._id)] = s.title || "Session";
      return acc;
    }, {});
    const sessionIds = Object.keys(sessionTitleMap);
    const records = await AttendanceRecord.find({ coach: coach._id, session: { $in: sessionIds } })
      .populate("player", "name email")
      .select("session player status occurrenceDate")
      .lean();

    const map = records.reduce((acc, r) => {
      const parentSessionId = String(r.session);
      const recordDate = r.occurrenceDate || new Date();
      const recordDateKey = dateKey(recordDate);
      const key = `${parentSessionId}-${recordDateKey}`;
      if (!acc[key]) {
        acc[key] = {
          sessionId: key,
          parentSessionId,
          title: `${sessionTitleMap[parentSessionId] || "Session"} (${recordDateKey})`,
          date: recordDate,
          total: 0,
          present: 0,
          absent: 0,
          excused: 0,
          players: [],
        };
      }
      acc[key].total += 1;
      if (r.status === "present" || r.status === "late") acc[key].present += 1;
      else if (r.status === "absent") acc[key].absent += 1;
      else acc[key].excused += 1;
      if (r.player?._id && !acc[key].players.some((p) => String(p.playerId) === String(r.player._id))) {
        acc[key].players.push({
          playerId: r.player._id,
          playerName: r.player.name || "Unknown",
          playerEmail: r.player.email || "",
        });
      }
      return acc;
    }, {});

    const data = Object.values(map).sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching session-wise attendance" });
  }
};

/**
 * @desc    Get player-wise attendance summary for coach
 * @route   GET /api/coaching-sessions/coach/attendance-by-player
 * @access  Private (Coach)
 */
export const getCoachPlayerWiseAttendance = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const records = await AttendanceRecord.find({ coach: coach._id })
      .populate("player", "name email")
      .select("player status")
      .lean();

    const playerMap = records.reduce((acc, r) => {
      const key = r.player?._id?.toString();
      if (!key) return acc;
      if (!acc[key]) {
        acc[key] = {
          playerId: r.player._id,
          playerName: r.player.name || "Unknown",
          playerEmail: r.player.email || "",
          total: 0,
          present: 0,
          absent: 0,
          excused: 0,
          attendancePercent: 0,
        };
      }
      acc[key].total += 1;
      if (r.status === "present" || r.status === "late") acc[key].present += 1;
      else if (r.status === "absent") acc[key].absent += 1;
      else acc[key].excused += 1;
      return acc;
    }, {});

    const data = Object.values(playerMap).map((p) => ({
      ...p,
      attendancePercent: p.total > 0 ? Number(((p.present / p.total) * 100).toFixed(2)) : 0,
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching player-wise attendance" });
  }
};

// ============================================================
// PLAYER endpoints
// ============================================================

/**
 * @desc    Get sessions the logged-in player is enrolled in
 * @route   GET /api/coaching-sessions/player/my
 * @access  Private (Player)
 */
export const getPlayerSessions = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.json({ success: true, data: [] });
    }

    const { status } = req.query;
    const query = { "students.player": player._id };
    if (status) query.status = status;

    const sessions = await CoachingSession.find(query)
      .populate("coach", "firstName lastName profilePhoto")
      .populate("sport", "name slug")
      .populate("academy", "name logo")
      .sort({ "schedule.date": -1 });
    const sessionIds = sessions.map((s) => s?._id).filter(Boolean);
    const attendanceRows = sessionIds.length
      ? await AttendanceRecord.find({
          session: { $in: sessionIds },
          player: player._id,
        })
          .select("session status occurrenceDate markedAt")
          .sort({ occurrenceDate: -1, markedAt: -1 })
          .lean()
      : [];
    const attendanceBySession = attendanceRows.reduce((acc, row) => {
      const key = String(row?.session || "");
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});

    const sessionsWithAttendance = sessions.map((session) => {
      const sessionObj = session.toObject();
      const sessionKey = String(session?._id || "");
      const myRows = attendanceBySession[sessionKey] || [];
      const currentOccurrence = normalizeDate(session?.schedule?.date || new Date());
      const currentOccurrenceKey = dateKey(currentOccurrence);
      const currentOccurrenceRecord = myRows.find(
        (row) => dateKey(row?.occurrenceDate || row?.markedAt || new Date()) === currentOccurrenceKey
      );
      return {
        ...sessionObj,
        myAttendance: {
          markedForCurrentOccurrence: Boolean(currentOccurrenceRecord),
          currentStatus: currentOccurrenceRecord?.status || "",
        },
        myAttendanceHistory: myRows.map((row) => ({
          status: row?.status || "",
          occurrenceDate: row?.occurrenceDate || row?.markedAt || null,
          markedAt: row?.markedAt || null,
        })),
      };
    });

    res.json({ success: true, data: sessionsWithAttendance });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching sessions" });
  }
};

/**
 * @desc    Get available sessions for logged-in player
 * @route   GET /api/coaching-sessions/player/available
 * @access  Private (Player)
 */
export const getPlayerAvailableSessions = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.json({ success: true, data: [] });
    }

    const activeRelations = await CoachStudentRelation.find({
      player: player._id,
      status: "active",
    }).select("coach");

    const activeCoachIds = activeRelations.map((r) => r.coach);
    if (activeCoachIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await CoachingSession.find({
      coach: { $in: activeCoachIds },
      status: { $in: ["scheduled", "in_progress"] },
      "schedule.date": { $gte: today },
    })
      .populate("coach", "firstName lastName profilePhoto")
      .populate("sport", "name slug")
      .populate("academy", "name logo")
      .sort({ "schedule.date": 1, "schedule.startTime": 1 });

    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching available sessions" });
  }
};

// ============================================================
// ACADEMY ADMIN endpoints
// ============================================================

/**
 * @desc    Get all sessions for the academy
 * @route   GET /api/coaching-sessions/academy
 * @access  Private (Academy Admin)
 */
export const getAcademySessions = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const { status, coach, sport } = req.query;
    const query = { academy: academy._id };
    if (status) query.status = status;
    if (coach) query.coach = coach;
    if (sport) query.sport = sport;

    const sessions = await CoachingSession.find(query)
      .populate("coach", "firstName lastName profilePhoto")
      .populate("sport", "name slug")
      .populate("students.player", "name email phone photo")
      .populate("metadata.assignedTeamId", "name sport")
      .sort({ "schedule.date": -1 });

    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching academy sessions" });
  }
};

/**
 * @desc    Academy admin creates a session and assigns a coach + players
 * @route   POST /api/coaching-sessions/academy
 * @access  Private (Academy Admin)
 */
export const createAcademySession = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const {
      coachId, sport, title, description, type, schedule,
      maxStudents, pricing, court, location, studentIds, teamId, billingScope, payoutRule, payerType,
    } = req.body;

    if (!coachId || !sport || !title) {
      return res.status(400).json({ success: false, message: "Coach, sport, and title are required" });
    }

    const coach = await Coach.findById(coachId);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }
    if (!isCoachActiveInAcademy(coach, academy._id)) {
      return res.status(400).json({
        success: false,
        message: "Selected coach is not an active member of this academy",
      });
    }

    let resolvedStudentIds = [...new Set((studentIds || []).map((id) => String(id)).filter(Boolean))];
    let assignedTeamId = null;
    if (teamId) {
      const { team, playerIds } = await resolvePlayerIdsFromTeam(teamId);
      if (!team) {
        return res.status(404).json({ success: false, message: "Team not found" });
      }
      if (!team.academy || String(team.academy) !== String(academy._id)) {
        return res.status(400).json({ success: false, message: "Team does not belong to this academy" });
      }
      if (sport && team.sport && String(team.sport) !== String(sport)) {
        return res.status(400).json({ success: false, message: "Team sport must match session sport" });
      }
      assignedTeamId = String(team._id);
      resolvedStudentIds = [...new Set([...resolvedStudentIds, ...playerIds])];
    }

    const sessionCapacity = maxStudents || 20;
    resolvedStudentIds = resolvedStudentIds.slice(0, Math.max(parseInt(sessionCapacity, 10) || 1, 1));
    const students = resolvedStudentIds.map((pid) => ({
      player: pid,
      status: "enrolled",
      enrolledAt: new Date(),
    }));

    const resolvedBillingScope = deriveBillingScope({
      type: type || "group",
      teamId: assignedTeamId || null,
      billingScope,
    });
    const payoutRuleError = validatePayoutRuleInput(payoutRule);
    if (payoutRuleError) {
      return res.status(400).json({ success: false, message: payoutRuleError });
    }
    if (resolvedBillingScope === "team" && !assignedTeamId) {
      return res.status(400).json({
        success: false,
        message: "Team billing scope requires an assigned team",
      });
    }
    if (assignedTeamId && resolvedBillingScope === "individual") {
      return res.status(400).json({
        success: false,
        message: "Team-assigned sessions cannot use individual billing scope",
      });
    }
    const requestedPayerType = String(payerType || "").trim().toLowerCase();
    let resolvedPayerTypeDefault = "";
    if (assignedTeamId) {
      if (requestedPayerType && !["team", "player"].includes(requestedPayerType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payerType. Allowed values: team, player",
        });
      }
      resolvedPayerTypeDefault = requestedPayerType || "team";
    } else {
      resolvedPayerTypeDefault = "player";
    }

    const session = await CoachingSession.create({
      coach: coach._id,
      academy: academy._id,
      sport,
      title: title.trim(),
      description: description || "",
      type: type || "group",
      ownerType: "academy",
      billingScope: resolvedBillingScope,
      schedule: {
        date: schedule?.date || new Date(),
        startTime: schedule?.startTime || "09:00",
        endTime: schedule?.endTime || "10:00",
        duration: schedule?.duration || 60,
        recurring: schedule?.recurring || false,
        recurrencePattern: schedule?.recurrencePattern || "",
      },
      maxStudents: sessionCapacity,
      students,
      pricing: pricing || { amount: 0, currency: "INR", type: "free" },
      court: court || null,
      location: location || "",
      createdBy: req.user._id,
      metadata: {
        assignedTeamId: assignedTeamId || null,
        payerTypeDefault: resolvedPayerTypeDefault,
        payoutRuleSnapshot: {
          model: payoutRule?.model || "",
          value: Number(payoutRule?.value || 0),
          currency: payoutRule?.currency || pricing?.currency || "INR",
        },
      },
    });

    await session.populate("sport", "name slug");
    await session.populate("coach", "firstName lastName profilePhoto");
    await session.populate("students.player", "name email phone photo");
    await session.populate("metadata.assignedTeamId", "name sport");

    res.status(201).json({ success: true, message: "Session created", data: session });
  } catch (error) {
    console.error("Create academy session error:", error);
    res.status(500).json({ success: false, message: "Error creating session", error: error.message });
  }
};
