import TrainingPlan from "../models/TrainingPlan.js";
import CoachingSession from "../models/CoachingSession.js";
import Coach from "../models/Coach.js";

const findCoachForUser = async (userId) => Coach.findOne({ userId });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeDate = (dateValue) => {
  const d = new Date(dateValue);
  d.setHours(0, 0, 0, 0);
  return d;
};

const WEEKDAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const normalizeWeekdays = (weekdays = []) => {
  if (!Array.isArray(weekdays)) return [];
  const cleaned = weekdays
    .map((d) => String(d || "").trim().toLowerCase())
    .filter((d) => Object.prototype.hasOwnProperty.call(WEEKDAY_MAP, d));
  return [...new Set(cleaned)];
};

const addPatternStep = (date, pattern) => {
  const d = new Date(date);
  if (pattern === "weekly") d.setDate(d.getDate() + 7);
  else if (pattern === "biweekly") d.setDate(d.getDate() + 14);
  else if (pattern === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + 1);
  return d;
};

/**
 * @desc    Create training plan
 * @route   POST /api/training-plans
 * @access  Private (Coach)
 */
export const createTrainingPlan = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const {
      sport,
      title,
      description = "",
      type = "one_on_one",
      recurrence = {},
      scheduleTemplate = {},
      capacity = {},
      pricing = {},
      location = {},
      participants = {},
      academy = null,
    } = req.body;
    const normalizedParticipants = [...new Set((participants?.players || []).map((id) => String(id)))];

    if (!sport || !title || !scheduleTemplate?.startTime || !scheduleTemplate?.endTime) {
      return res.status(400).json({
        success: false,
        message: "sport, title, scheduleTemplate.startTime and endTime are required",
      });
    }

    const normalizedTitle = title.trim();
    const duplicateByTitle = await TrainingPlan.findOne({
      coach: coach._id,
      title: new RegExp(`^${escapeRegex(normalizedTitle)}$`, "i"),
    }).select("_id");

    if (duplicateByTitle) {
      return res.status(409).json({
        success: false,
        message: "A training plan with this title already exists",
      });
    }

    if (pricing?.type === "package" && pricing?.packageMeta?.billingCycle && pricing.packageMeta.billingCycle !== "monthly") {
      return res.status(400).json({
        success: false,
        message: "Package billingCycle currently supports monthly only",
      });
    }

    const plan = await TrainingPlan.create({
      coach: coach._id,
      academy,
      sport,
      title: normalizedTitle,
      description,
      type,
      recurrence: {
        enabled: !!recurrence?.enabled,
        pattern: recurrence?.pattern || "",
        weekdays: normalizeWeekdays(recurrence?.weekdays),
      },
      scheduleTemplate: {
        startTime: scheduleTemplate.startTime,
        endTime: scheduleTemplate.endTime,
        duration: scheduleTemplate.duration || 60,
      },
      capacity: {
        maxStudents: capacity?.maxStudents || (type === "one_on_one" ? 1 : 20),
      },
      pricing: {
        type: pricing?.type || "free",
        amount: pricing?.amount || 0,
        currency: pricing?.currency || "INR",
        packageMeta: {
          billingCycle: pricing?.packageMeta?.billingCycle || "",
          sessionsIncluded: pricing?.packageMeta?.sessionsIncluded || null,
          validityDays: pricing?.packageMeta?.validityDays || null,
        },
      },
      location: {
        court: location?.court || null,
        label: location?.label || "",
      },
      participants: {
        players: normalizedParticipants,
      },
      createdBy: req.user._id,
    });

    await plan.populate("sport", "name slug");
    await plan.populate("participants.players", "name email");

    return res.status(201).json({ success: true, message: "Training plan created", data: plan });
  } catch (error) {
    console.error("Create training plan error:", error);
    return res.status(500).json({ success: false, message: "Error creating training plan", error: error.message });
  }
};

/**
 * @desc    Get my training plans
 * @route   GET /api/training-plans/my
 * @access  Private (Coach)
 */
export const getMyTrainingPlans = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const { status } = req.query;
    const query = { coach: coach._id };
    if (status) query.status = status;

    const plans = await TrainingPlan.find(query)
      .populate("sport", "name slug")
      .populate("participants.players", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: plans.length, data: plans });
  } catch (error) {
    console.error("Get training plans error:", error);
    return res.status(500).json({ success: false, message: "Error fetching training plans", error: error.message });
  }
};

/**
 * @desc    Update training plan
 * @route   PUT /api/training-plans/:id
 * @access  Private (Coach)
 */
export const updateTrainingPlan = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const plan = await TrainingPlan.findOne({ _id: req.params.id, coach: coach._id });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Training plan not found" });
    }

    const updates = req.body || {};
    if (updates.title !== undefined) plan.title = updates.title.trim();
    if (updates.description !== undefined) plan.description = updates.description;
    if (updates.type !== undefined) plan.type = updates.type;
    if (updates.status !== undefined) plan.status = updates.status;
    if (updates.recurrence !== undefined) {
      plan.recurrence.enabled = !!updates.recurrence.enabled;
      plan.recurrence.pattern = updates.recurrence.pattern || "";
      if (updates.recurrence.weekdays !== undefined) {
        plan.recurrence.weekdays = normalizeWeekdays(updates.recurrence.weekdays);
      }
    }
    if (updates.scheduleTemplate !== undefined) {
      if (updates.scheduleTemplate.startTime !== undefined) plan.scheduleTemplate.startTime = updates.scheduleTemplate.startTime;
      if (updates.scheduleTemplate.endTime !== undefined) plan.scheduleTemplate.endTime = updates.scheduleTemplate.endTime;
      if (updates.scheduleTemplate.duration !== undefined) plan.scheduleTemplate.duration = updates.scheduleTemplate.duration;
    }
    if (updates.capacity?.maxStudents !== undefined) plan.capacity.maxStudents = updates.capacity.maxStudents;
    if (updates.pricing !== undefined) {
      plan.pricing.type = updates.pricing.type || plan.pricing.type;
      plan.pricing.amount = updates.pricing.amount ?? plan.pricing.amount;
      plan.pricing.currency = updates.pricing.currency || plan.pricing.currency;
      if (updates.pricing.packageMeta !== undefined) {
        plan.pricing.packageMeta.billingCycle = updates.pricing.packageMeta.billingCycle || "";
        plan.pricing.packageMeta.sessionsIncluded = updates.pricing.packageMeta.sessionsIncluded || null;
        plan.pricing.packageMeta.validityDays = updates.pricing.packageMeta.validityDays || null;
      }
    }
    if (updates.location !== undefined) {
      plan.location.court = updates.location.court || null;
      plan.location.label = updates.location.label || "";
    }
    const participantsUpdated = updates.participants?.players !== undefined;
    const normalizedPlayers = participantsUpdated
      ? [...new Set((updates.participants.players || []).map((id) => String(id)))]
      : [];
    if (participantsUpdated) {
      plan.participants.players = normalizedPlayers;
    }

    await plan.save();

    let syncedSessions = 0;
    let syncedPlayers = 0;
    let skippedByCapacity = 0;
    if (participantsUpdated) {
      const today = normalizeDate(new Date());
      const upcomingSessions = await CoachingSession.find({
        coach: coach._id,
        "metadata.trainingPlanId": plan._id,
        status: { $in: ["scheduled", "in_progress"] },
        "schedule.date": { $gte: today },
      }).select("students maxStudents");

      for (const session of upcomingSessions) {
        const existingIds = new Set((session.students || []).map((s) => String(s.player)));
        const availableSlots = Math.max((session.maxStudents || 1) - existingIds.size, 0);
        const missingIds = normalizedPlayers.filter((pid) => !existingIds.has(pid));
        const toAdd = missingIds.slice(0, availableSlots);
        skippedByCapacity += Math.max(missingIds.length - toAdd.length, 0);

        if (!toAdd.length) continue;

        toAdd.forEach((pid) => {
          session.students.push({
            player: pid,
            status: "enrolled",
            attended: false,
            enrolledAt: new Date(),
          });
        });
        await session.save();
        syncedSessions += 1;
        syncedPlayers += toAdd.length;
      }
    }
    await plan.populate("sport", "name slug");
    await plan.populate("participants.players", "name email");

    return res.status(200).json({
      success: true,
      message: "Training plan updated",
      data: plan,
      syncSummary: {
        syncedSessions,
        syncedPlayers,
        skippedByCapacity,
      },
    });
  } catch (error) {
    console.error("Update training plan error:", error);
    return res.status(500).json({ success: false, message: "Error updating training plan", error: error.message });
  }
};

/**
 * @desc    Generate recurring session occurrences from plan
 * @route   POST /api/training-plans/:id/generate-occurrences
 * @access  Private (Coach)
 */
export const generatePlanOccurrences = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const plan = await TrainingPlan.findOne({ _id: req.params.id, coach: coach._id });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Training plan not found" });
    }
    if (!plan.recurrence?.enabled || !plan.recurrence?.pattern) {
      return res.status(400).json({ success: false, message: "Plan recurrence is not enabled" });
    }

    const { startDate, count = 4 } = req.body;
    if (!startDate) {
      return res.status(400).json({ success: false, message: "startDate is required" });
    }
    const today = normalizeDate(new Date());
    const requestedStart = normalizeDate(startDate);
    if (requestedStart < today) {
      return res.status(400).json({
        success: false,
        message: "Start date must be today or a future date",
      });
    }
    const maxCount = Math.min(Math.max(parseInt(count, 10) || 4, 1), 52);

    const startCursor = requestedStart;
    const created = [];
    const weekdays = normalizeWeekdays(plan.recurrence?.weekdays);
    const weekdayIndexes = new Set(weekdays.map((d) => WEEKDAY_MAP[d]));
    const useWeekdays = weekdayIndexes.size > 0;

    for (let cycle = 0; cycle < maxCount; cycle += 1) {
      let cycleStart = new Date(startCursor);
      for (let i = 0; i < cycle; i += 1) {
        cycleStart = addPatternStep(cycleStart, plan.recurrence.pattern || "weekly");
      }
      cycleStart = normalizeDate(cycleStart);
      const cycleEnd = normalizeDate(addPatternStep(cycleStart, plan.recurrence.pattern || "weekly"));

      let occurrenceDate = new Date(cycleStart);
      if (useWeekdays) {
        let found = false;
        const cursor = new Date(cycleStart);
        while (cursor < cycleEnd) {
          if (weekdayIndexes.has(cursor.getDay())) {
            occurrenceDate = new Date(cursor);
            found = true;
            break;
          }
          cursor.setDate(cursor.getDate() + 1);
        }
        if (!found) continue;
      }

      const duplicate = await CoachingSession.findOne({
        coach: coach._id,
        sport: plan.sport,
        type: plan.type,
        "schedule.date": occurrenceDate,
        "schedule.startTime": plan.scheduleTemplate.startTime,
        "schedule.endTime": plan.scheduleTemplate.endTime,
      }).select("_id");

      if (duplicate) continue;

      const students = (plan.participants?.players || []).map((pid) => ({
        player: pid,
        status: "enrolled",
        attended: false,
        enrolledAt: new Date(),
      }));

      const occurrence = await CoachingSession.create({
        coach: coach._id,
        academy: plan.academy || null,
        sport: plan.sport,
        title: plan.title,
        description: plan.description || "",
        type: plan.type,
        schedule: {
          date: occurrenceDate,
          startTime: plan.scheduleTemplate.startTime,
          endTime: plan.scheduleTemplate.endTime,
          duration: plan.scheduleTemplate.duration || 60,
          recurring: true,
          recurrencePattern: plan.recurrence.pattern,
        },
        maxStudents: plan.capacity?.maxStudents || (plan.type === "one_on_one" ? 1 : 20),
        students,
        pricing: {
          amount: plan.pricing?.amount || 0,
          currency: plan.pricing?.currency || "INR",
          type: plan.pricing?.type || "free",
          packageMeta: {
            billingCycle: plan.pricing?.packageMeta?.billingCycle || "",
            sessionsIncluded: plan.pricing?.packageMeta?.sessionsIncluded || null,
            validityDays: plan.pricing?.packageMeta?.validityDays || null,
          },
        },
        court: plan.location?.court || null,
        location: plan.location?.label || "",
        createdBy: req.user._id,
        metadata: {
          trainingPlanId: plan._id.toString(),
          occurrenceCycleStartDate: cycleStart,
          occurrenceCycleEndDate: cycleEnd,
        },
      });

      created.push(occurrence);
    }

    return res.status(201).json({
      success: true,
      message: `${created.length} occurrence(s) generated`,
      count: created.length,
      data: created,
    });
  } catch (error) {
    console.error("Generate plan occurrences error:", error);
    return res.status(500).json({ success: false, message: "Error generating occurrences", error: error.message });
  }
};
