import Coach from "../../models/Coach.js";
import Player from "../../models/Player.js";
import CoachStudentRelation from "../../models/CoachStudentRelation.js";

/**
 * @desc    Get public coach details + player specific stats
 * @route   GET /api/coaches/public/:id/player-view
 * @access  Private (Player-capable roles)
 */
export const getPublicCoachPlayerView = async (req, res) => {
  try {
    const coachId = req.params.id;

    const coach = await Coach.findOne({
      _id: coachId,
      status: "APPROVED",
      isActive: true,
    })
      .populate("academies.academy", "name logo address")
      .populate("userId", "profilePhoto")
      .select("-kycDocuments -metadata");

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    const player = await Player.findOne({ user: req.user._id });
    const playerId = player?._id;

    if (!playerId) {
      return res.status(200).json({
        success: true,
        data: {
          coach,
          playerStats: {
            totalSessionsWithCoach: 0,
            completedSessionsWithCoach: 0,
            activeSportsWithCoach: 0,
            isTrainingActive: false,
          },
        },
      });
    }

    const [playerRelations, activeSportsWithCoach, coachRelations] = await Promise.all([
      CoachStudentRelation.find({
        coach: coachId,
        player: playerId,
      }).select("status sessionsCompleted"),
      CoachStudentRelation.countDocuments({
        coach: coachId,
        player: playerId,
        status: "active",
      }),
      CoachStudentRelation.find({
        coach: coachId,
      }).select("status player sessionsCompleted"),
    ]);

    const completedSessionsWithCoach = playerRelations.reduce(
      (sum, rel) => sum + (rel.sessionsCompleted || 0),
      0
    );
    const totalSessionsWithCoach = completedSessionsWithCoach;

    const activePlayerIds = new Set(
      coachRelations
        .filter((rel) => rel.status === "active")
        .map((rel) => String(rel.player))
    );
    const coachTotalStudents = activePlayerIds.size;
    const coachTotalSessions = coachRelations
      .filter((rel) => rel.status === "active")
      .reduce((sum, rel) => sum + (rel.sessionsCompleted || 0), 0);

    const coachData = coach.toObject();
    coachData.totalStudentsTaught = coachTotalStudents;
    coachData.totalSessionsConducted = coachTotalSessions;

    return res.status(200).json({
      success: true,
      data: {
        coach: coachData,
        playerStats: {
          totalSessionsWithCoach,
          completedSessionsWithCoach,
          activeSportsWithCoach,
          isTrainingActive: activeSportsWithCoach > 0,
        },
      },
    });
  } catch (error) {
    console.error("Get public coach player view error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching coach details",
      error: error.message,
    });
  }
};
