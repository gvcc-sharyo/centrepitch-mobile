import CoachingEnrollment from "../models/CoachingEnrollment.js";
import CoachingSession from "../models/CoachingSession.js";
import Player from "../models/Player.js";
import Coach from "../models/Coach.js";
import SportsAcademy from "../models/SportsAcademy.js";
import Notification from "../models/Notification.js";
import TrainingPlan from "../models/TrainingPlan.js";

const getPlayerForUser = async (userId) => {
  return Player.findOne({ user: userId });
};
const findCoachForUser = async (userId) => Coach.findOne({ userId });
const TRIAL_HOURS = 24;
const resolveEnrollmentOwnerType = (session) => {
  if (!session) return "coach";
  if (session.ownerType === "academy" || session.academy) return "academy";
  return "coach";
};
const resolveDefaultPayer = (session) => {
  if (session?.metadata?.assignedTeamId) {
    if (session?.metadata?.payerTypeDefault === "player") {
      return { payerType: "player", payerRef: null };
    }
    return { payerType: "team", payerRef: session.metadata.assignedTeamId };
  }
  return { payerType: "player", payerRef: null };
};

const syncTrialStatus = async (enrollment) => {
  if (!enrollment) return null;
  if (!enrollment.isTrial) return enrollment;
  if (enrollment.paymentStatus === "PAID") return enrollment;
  if (!enrollment.trialEndsAt) return enrollment;

  const isExpired = new Date(enrollment.trialEndsAt) <= new Date();
  if (!isExpired) return enrollment;

  enrollment.status = "PENDING_PAYMENT";
  enrollment.isTrial = false;
  await enrollment.save();
  return enrollment;
};

const addStudentToSessionIfMissing = async (session, playerId) => {
  const exists = (session.students || []).some(
    (s) => s.player?.toString() === playerId.toString()
  );
  if (exists) return false;

  session.students.push({
    player: playerId,
    status: "enrolled",
    attended: false,
    enrolledAt: new Date(),
  });
  await session.save();
  return true;
};

const getMonthBounds = (dateValue) => {
  const base = new Date(dateValue || new Date());
  if (Number.isNaN(base.getTime())) {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }
  return {
    start: new Date(base.getFullYear(), base.getMonth(), 1),
    end: new Date(base.getFullYear(), base.getMonth() + 1, 1),
  };
};

const getPackageSessionsIncluded = async (session) => {
  const direct = Number(session?.pricing?.packageMeta?.sessionsIncluded || 0);
  if (direct > 0) return direct;

  const planId = session?.metadata?.trainingPlanId;
  if (!planId) return null;

  const plan = await TrainingPlan.findById(planId).select("pricing.packageMeta.sessionsIncluded");
  const fromPlan = Number(plan?.pricing?.packageMeta?.sessionsIncluded || 0);
  return fromPlan > 0 ? fromPlan : null;
};

const checkMonthlyPackageLimit = async ({ userId, session }) => {
  if (session?.pricing?.type !== "package") return { allowed: true };

  const sessionsIncluded = await getPackageSessionsIncluded(session);
  const planId = session?.metadata?.trainingPlanId;
  if (!sessionsIncluded || !planId) return { allowed: true };

  const { start, end } = getMonthBounds(session?.schedule?.date);
  const monthSessionIds = await CoachingSession.find({
    "metadata.trainingPlanId": planId,
    "schedule.date": { $gte: start, $lt: end },
  }).distinct("_id");

  if (!monthSessionIds.length) return { allowed: true };

  const usedCount = await CoachingEnrollment.countDocuments({
    user: userId,
    session: { $in: monthSessionIds },
    status: { $in: ["ACTIVE", "COMPLETED"] },
  });

  if (usedCount >= sessionsIncluded) {
    return {
      allowed: false,
      usedCount,
      sessionsIncluded,
    };
  }

  return { allowed: true };
};

/**
 * @desc    Create coaching enrollment
 * @route   POST /api/coaching-enrollments
 * @access  Private (Player)
 */
export const createEnrollment = async (req, res) => {
  try {
    const player = await getPlayerForUser(req.user._id);
    if (!player) {
      return res.status(404).json({ success: false, message: "Player profile not found" });
    }

    const { sessionId, notes, payerType, payerRef } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    const session = await CoachingSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    if (!["scheduled", "in_progress"].includes(session.status)) {
      return res.status(400).json({
        success: false,
        message: "Only scheduled or in-progress sessions can be enrolled",
      });
    }

    const alreadyInSession = (session.students || []).some(
      (s) => s.player?.toString() === player._id.toString()
    );
    if ((session.students || []).length >= (session.maxStudents || 1) && !alreadyInSession) {
      return res.status(400).json({ success: false, message: "Session is full" });
    }

    let existing = await CoachingEnrollment.findOne({
      user: req.user._id,
      session: session._id,
      status: { $in: ["REQUESTED", "PENDING_PAYMENT", "ACTIVE"] },
    });
    existing = await syncTrialStatus(existing);

    if (existing) {
      if (existing.status === "REQUESTED") {
        return res.status(400).json({
          success: false,
          message: "Your request to join this session is pending coach approval.",
        });
      }
      if (existing.status === "PENDING_PAYMENT") {
        return res.status(400).json({
          success: false,
          message: "Payment is pending for this session. Please complete payment to continue.",
        });
      }
      return res.status(400).json({
        success: false,
        message: "You already have an active enrollment for this session",
      });
    }

    const pricingSnapshot = {
      amount: session.pricing?.amount || 0,
      currency: session.pricing?.currency || "INR",
      type: session.pricing?.type || "free",
    };
    const ownerType = resolveEnrollmentOwnerType(session);
    const defaultPayer = resolveDefaultPayer(session);
    const resolvedPayerType = payerType || defaultPayer.payerType;
    const resolvedPayerRef = payerRef || defaultPayer.payerRef || null;

    // If coach already assigned player to this session, do not create a join request.
    // Start direct enrollment/payment flow.
    if (alreadyInSession) {
      const packageLimitCheck = await checkMonthlyPackageLimit({
        userId: req.user._id,
        session,
      });
      if (!packageLimitCheck.allowed) {
        return res.status(400).json({
          success: false,
          message: `Monthly package limit reached (${packageLimitCheck.usedCount}/${packageLimitCheck.sessionsIncluded}).`,
        });
      }

      const isFree = pricingSnapshot.type === "free" || pricingSnapshot.amount <= 0;
      let canUseTrial = false;
      if (!isFree) {
        const priorTrialEnrollment = await CoachingEnrollment.findOne({
          user: req.user._id,
          session: session._id,
          trialUsed: true,
        }).select("_id");
        canUseTrial = !priorTrialEnrollment;
      }
      const trialEndsAt = canUseTrial
        ? new Date(Date.now() + TRIAL_HOURS * 60 * 60 * 1000)
        : null;

      const enrollment = await CoachingEnrollment.create({
        player: player._id,
        user: req.user._id,
        session: session._id,
        academy: session.academy || null,
        coach: session.coach,
        sport: session.sport,
        ownerType,
        payerType: resolvedPayerType,
        payerRef: resolvedPayerRef,
        approvedByRole: "system",
        status: isFree || canUseTrial ? "ACTIVE" : "PENDING_PAYMENT",
        paymentStatus: isFree ? "PAID" : "PENDING",
        isTrial: canUseTrial,
        trialUsed: canUseTrial,
        trialStartedAt: canUseTrial ? new Date() : null,
        trialEndsAt,
        pricingSnapshot,
        notes: notes || "",
      });

      await enrollment.populate([
        { path: "session", select: "title schedule status pricing" },
        { path: "coach", select: "firstName lastName profilePhoto" },
        { path: "sport", select: "name slug" },
      ]);

      return res.status(201).json({
        success: true,
        message: isFree
          ? "Enrollment activated successfully"
          : canUseTrial
            ? "1-day free trial activated. Pay next time to continue this session."
            : "Enrollment created. Please complete payment to continue.",
        data: enrollment,
      });
    }

    const enrollment = await CoachingEnrollment.create({
      player: player._id,
      user: req.user._id,
      session: session._id,
      academy: session.academy || null,
      coach: session.coach,
      sport: session.sport,
      ownerType,
      payerType: resolvedPayerType,
      payerRef: resolvedPayerRef,
      approvedByRole: "",
      status: "REQUESTED",
      paymentStatus: "PENDING",
      isTrial: false,
      trialUsed: false,
      trialStartedAt: null,
      trialEndsAt: null,
      pricingSnapshot,
      notes: notes || "",
    });

    await enrollment.populate([
      { path: "session", select: "title schedule status pricing" },
      { path: "coach", select: "firstName lastName profilePhoto" },
      { path: "sport", select: "name slug" },
    ]);

    return res.status(201).json({
      success: true,
      message: "Join request sent. Waiting for coach approval.",
      data: enrollment,
    });
  } catch (error) {
    console.error("Create enrollment error:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating enrollment",
      error: error.message,
    });
  }
};

/**
 * @desc    Update enrollment payment status
 * @route   PUT /api/coaching-enrollments/:id/payment
 * @access  Private (Player)
 */
export const updateEnrollmentPaymentStatus = async (req, res) => {
  try {
    const { paymentMethod, transactionId, paymentGateway, paymentResponse } = req.body;
    let enrollment = await CoachingEnrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({ success: false, message: "Enrollment not found" });
    }

    if (enrollment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    enrollment = await syncTrialStatus(enrollment);

    if (enrollment.status === "REQUESTED") {
      return res.status(400).json({
        success: false,
        message: "Coach approval is pending for this session request.",
      });
    }

    if (enrollment.payerType === "team") {
      return res.status(403).json({
        success: false,
        message: "This session is configured for team-level payment. Academy admin will complete payment.",
      });
    }

    if (enrollment.paymentStatus === "PAID" && enrollment.status === "ACTIVE") {
      return res.status(200).json({
        success: true,
        message: "Payment already confirmed",
        data: enrollment,
      });
    }

    const session = await CoachingSession.findById(enrollment.session);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const player = await getPlayerForUser(req.user._id);
    const alreadyInSession = !!player && (session.students || []).some(
      (s) => s.player?.toString() === player._id.toString()
    );
    if ((session.students || []).length >= (session.maxStudents || 1) && !alreadyInSession) {
      return res.status(400).json({ success: false, message: "Session is full. Unable to confirm payment." });
    }

    const packageLimitCheck = await checkMonthlyPackageLimit({
      userId: req.user._id,
      session,
    });
    if (!packageLimitCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: `Monthly package limit reached (${packageLimitCheck.usedCount}/${packageLimitCheck.sessionsIncluded}).`,
      });
    }

    enrollment.paymentStatus = "PAID";
    enrollment.status = "ACTIVE";
    enrollment.isTrial = false;
    enrollment.paymentMethod = paymentMethod;
    enrollment.paymentDetails = {
      transactionId,
      paymentGateway,
      paidAt: new Date(),
      paymentResponse,
    };
    await enrollment.save();

    if (player) {
      await addStudentToSessionIfMissing(session, player._id);
    }

    await enrollment.populate([
      { path: "session", select: "title schedule status pricing" },
      { path: "coach", select: "firstName lastName profilePhoto" },
      { path: "sport", select: "name slug" },
    ]);

    // Notify coach that player completed payment.
    const coachProfile = await Coach.findById(enrollment.coach).select("userId firstName lastName");
    if (coachProfile?.userId) {
      await Notification.create({
        recipient: coachProfile.userId,
        sender: req.user._id,
        type: "payment_received",
        title: "Session Payment Received",
        message: `A player completed payment for session "${session.title}".`,
        data: {
          link: "/coach/sessions",
          additionalInfo: {
            enrollmentId: enrollment._id,
            sessionId: session._id,
            amount: enrollment.pricingSnapshot?.amount || 0,
            currency: enrollment.pricingSnapshot?.currency || "INR",
            playerUserId: req.user._id,
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment confirmed. Enrollment is now active.",
      data: enrollment,
    });
  } catch (error) {
    console.error("Update enrollment payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating enrollment payment",
      error: error.message,
    });
  }
};

/**
 * @desc    Academy admin marks team session payment as paid
 * @route   PUT /api/coaching-enrollments/academy/session/:sessionId/team-payment
 * @access  Private (Academy Admin)
 */
export const academyMarkTeamSessionPayment = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id }).select("_id");
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const session = await CoachingSession.findOne({
      _id: req.params.sessionId,
      academy: academy._id,
    }).select("academy coach sport pricing students metadata ownerType");

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }
    if (session.ownerType !== "academy") {
      return res.status(400).json({ success: false, message: "Only academy-owned sessions can be paid here" });
    }
    if (!session?.metadata?.assignedTeamId) {
      return res.status(400).json({ success: false, message: "This is not a team-assigned session" });
    }
    if (session?.metadata?.payerTypeDefault !== "team") {
      return res.status(400).json({
        success: false,
        message: "This session is configured for individual player payment",
      });
    }

    const paymentMethod = req.body?.paymentMethod || "OTHER";
    const paymentRef = String(req.body?.paymentRef || "").trim() || `ACA-TEAM-PAY-${Date.now()}`;
    const paymentGateway = req.body?.paymentGateway || "ACADEMY_INTERNAL";
    const paymentResponse = req.body?.paymentResponse || { status: "SUCCESS", paymentRef };
    const assignedTeamId = session?.metadata?.assignedTeamId?._id || session?.metadata?.assignedTeamId || null;
    const sessionPlayerIds = [
      ...new Set(
        (session.students || [])
          .map((s) => s?.player?._id || s?.player || null)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];
    if (!sessionPlayerIds.length) {
      return res.status(400).json({ success: false, message: "No players found in this team session" });
    }

    const players = await Player.find({ _id: { $in: sessionPlayerIds } }).select("_id user");
    const userByPlayer = players.reduce((acc, p) => {
      acc[String(p._id)] = p.user ? String(p.user) : "";
      return acc;
    }, {});

    const existingRows = await CoachingEnrollment.find({
      session: session._id,
      player: { $in: sessionPlayerIds },
    })
      .sort({ createdAt: -1 })
      .select("_id player user paymentStatus status");
    const latestEnrollmentByPlayer = existingRows.reduce((acc, row) => {
      const key = String(row.player);
      if (!acc[key]) acc[key] = row;
      return acc;
    }, {});

    let paidCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    const now = new Date();
    const updates = [];
    const inserts = [];

    for (const playerId of sessionPlayerIds) {
      const playerUserId = userByPlayer[playerId];
      if (!playerUserId) {
        skippedCount += 1;
        continue;
      }

      const row = latestEnrollmentByPlayer[playerId];
      if (row) {
        updates.push({
          updateOne: {
            filter: { _id: row._id },
            update: {
              $set: {
                paymentStatus: "PAID",
                status: "ACTIVE",
                isTrial: false,
                payerType: "team",
                payerRef: assignedTeamId,
                ownerType: "academy",
                approvedByRole: "academy_admin",
                paymentMethod,
                paymentDetails: {
                  transactionId: paymentRef,
                  paymentGateway,
                  paidAt: now,
                  paymentResponse,
                },
              },
            },
          },
        });
        paidCount += 1;
      } else {
        inserts.push({
          player: playerId,
          user: playerUserId,
          session: session._id,
          academy: session.academy || null,
          coach: session.coach,
          sport: session.sport,
          ownerType: "academy",
          payerType: "team",
          payerRef: assignedTeamId,
          approvedByRole: "academy_admin",
          status: "ACTIVE",
          paymentStatus: "PAID",
          isTrial: false,
          trialUsed: false,
          trialStartedAt: null,
          trialEndsAt: null,
          pricingSnapshot: {
            amount: session.pricing?.amount || 0,
            currency: session.pricing?.currency || "INR",
            type: session.pricing?.type || "free",
          },
          paymentMethod,
          paymentDetails: {
            transactionId: paymentRef,
            paymentGateway,
            paidAt: now,
            paymentResponse,
          },
          notes: "Marked paid by academy admin for team session",
        });
        createdCount += 1;
      }
    }

    if (updates.length) {
      await CoachingEnrollment.bulkWrite(updates, { ordered: false });
    }
    if (inserts.length) {
      await CoachingEnrollment.insertMany(inserts, { ordered: false });
    }

    return res.json({
      success: true,
      message: "Team session payment marked successfully",
      data: {
        sessionId: session._id,
        paidCount,
        createdCount,
        skippedCount,
      },
    });
  } catch (error) {
    console.error("Academy team payment mark error:", error);
    return res.status(500).json({
      success: false,
      message: "Error marking team session payment",
      error: error.message,
    });
  }
};

/**
 * @desc    Coach approves a player's join request
 * @route   PUT /api/coaching-enrollments/:id/approve
 * @access  Private (Coach)
 */
export const approveEnrollmentRequest = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    let enrollment = await CoachingEnrollment.findById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ success: false, message: "Enrollment request not found" });
    }
    if (enrollment.coach.toString() !== coach._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (enrollment.status !== "REQUESTED") {
      return res.status(400).json({ success: false, message: `Request is already ${enrollment.status}` });
    }

    const session = await CoachingSession.findById(enrollment.session);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }
    if (!["scheduled", "in_progress"].includes(session.status)) {
      return res.status(400).json({ success: false, message: "Session is not open for approvals" });
    }

    const alreadyInSession = (session.students || []).some(
      (s) => s.player?.toString() === enrollment.player.toString()
    );
    if ((session.students || []).length >= (session.maxStudents || 1) && !alreadyInSession) {
      return res.status(400).json({ success: false, message: "Session is full" });
    }

    const packageLimitCheck = await checkMonthlyPackageLimit({
      userId: enrollment.user,
      session,
    });
    if (!packageLimitCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: `Monthly package limit reached (${packageLimitCheck.usedCount}/${packageLimitCheck.sessionsIncluded}).`,
      });
    }

    const isFree = enrollment.pricingSnapshot?.type === "free" || (enrollment.pricingSnapshot?.amount || 0) <= 0;
    let canUseTrial = false;
    if (!isFree) {
      const priorTrialEnrollment = await CoachingEnrollment.findOne({
        user: enrollment.user,
        session: session._id,
        trialUsed: true,
      }).select("_id");
      canUseTrial = !priorTrialEnrollment;
    }
    const trialEndsAt = canUseTrial ? new Date(Date.now() + TRIAL_HOURS * 60 * 60 * 1000) : null;

    enrollment.status = isFree || canUseTrial ? "ACTIVE" : "PENDING_PAYMENT";
    enrollment.paymentStatus = isFree ? "PAID" : "PENDING";
    enrollment.approvedByRole = "coach";
    enrollment.isTrial = canUseTrial;
    enrollment.trialUsed = canUseTrial;
    enrollment.trialStartedAt = canUseTrial ? new Date() : null;
    enrollment.trialEndsAt = trialEndsAt;
    await enrollment.save();

    if (isFree || canUseTrial) {
      await addStudentToSessionIfMissing(session, enrollment.player);
    }

    await enrollment.populate([
      { path: "session", select: "title schedule status pricing" },
      { path: "sport", select: "name slug" },
    ]);

    return res.status(200).json({
      success: true,
      message: isFree
        ? "Join request approved. Enrollment is active."
        : canUseTrial
          ? "Join request approved. 1-day trial started."
          : "Join request approved. Waiting for player payment.",
      data: enrollment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error approving enrollment request",
      error: error.message,
    });
  }
};

/**
 * @desc    Coach rejects a player's join request
 * @route   PUT /api/coaching-enrollments/:id/reject
 * @access  Private (Coach)
 */
export const rejectEnrollmentRequest = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const enrollment = await CoachingEnrollment.findById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ success: false, message: "Enrollment request not found" });
    }
    if (enrollment.coach.toString() !== coach._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (enrollment.status !== "REQUESTED") {
      return res.status(400).json({ success: false, message: `Request is already ${enrollment.status}` });
    }

    enrollment.status = "REJECTED_BY_COACH";
    enrollment.cancellation = {
      ...(enrollment.cancellation || {}),
      reason: req.body?.reason || "Rejected by coach",
      cancelledAt: new Date(),
      refundStatus: "NOT_APPLICABLE",
    };
    await enrollment.save();

    return res.status(200).json({
      success: true,
      message: "Join request rejected",
      data: enrollment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error rejecting enrollment request",
      error: error.message,
    });
  }
};

/**
 * @desc    Get my enrollments
 * @route   GET /api/coaching-enrollments/my
 * @access  Private (Player)
 */
export const getMyEnrollments = async (req, res) => {
  try {
    // Auto-expire active unpaid trials after 24 hours.
    await CoachingEnrollment.updateMany(
      {
        user: req.user._id,
        isTrial: true,
        paymentStatus: { $ne: "PAID" },
        status: "ACTIVE",
        trialEndsAt: { $lte: new Date() },
      },
      {
        $set: {
          status: "PENDING_PAYMENT",
          isTrial: false,
        },
      }
    );

    const { status } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;

    const enrollments = await CoachingEnrollment.find(query)
      .populate("session", "title schedule status pricing location")
      .populate("coach", "firstName lastName profilePhoto")
      .populate("sport", "name slug")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: enrollments.length,
      data: enrollments,
    });
  } catch (error) {
    console.error("Get my enrollments error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching enrollments",
      error: error.message,
    });
  }
};

