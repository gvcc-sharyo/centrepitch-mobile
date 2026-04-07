// ==========================================
// server.js - UPDATED with Academy Integration
// ==========================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";
import connectDB from "./config/db.js";
import { setLiveScoreIo } from "./utils/liveScoreBroadcast.js";
import { handleStripeWebhook } from "./controllers/paymentController.js";

// Import existing routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import organizerRoutes from "./routes/organizerRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import scorerRoutes from "./routes/scorerRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import sportRoutes from "./routes/sportRoutes.js";
import coachingSportRoutes from "./routes/coachingSportRoutes.js";

// ✨ NEW IMPORTS - Academy, Coach, Court, Booking modules
import academyRoutes from "./routes/academyRoutes.js";
import coachRoutes from "./routes/coachRoutes.js";
import courtRoutes from "./routes/courtRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import kycRoutes from "./routes/kycRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import pendingRoutes from "./routes/pendingRoutes.js";
import joinRequestRoutes from "./routes/joinRequestRoutes.js";
import playerJoinRequestRoutes from "./routes/playerJoinRequestRoutes.js";
import academyRoleRoutes from "./routes/academyRoleRoutes.js";
import coachSessionRoutes from "./routes/coachSessionRoutes.js";
import coachStudentRoutes from "./routes/coachStudentRoutes.js";
import coachTeamRoutes from "./routes/coachTeamRoutes.js";
import coachingEnrollmentRoutes from "./routes/coachingEnrollmentRoutes.js";
import trainingPlanRoutes from "./routes/trainingPlanRoutes.js";
import coachPayoutRoutes from "./routes/coachPayoutRoutes.js";
import sportTemplateRoutes from "./routes/sportTemplateRoutes.js";
import courtPlanRoutes from "./routes/courtPlanRoutes.js";
import courtSubscriptionRoutes from "./routes/courtSubscriptionRoutes.js";
import { seedRolesAndPermissions } from "./services/rbacSeedService.js";
import { migrateUserSportCollection } from "./services/userSportCollectionMigration.js";
import { seedSubscriptionPlans } from "./services/subscriptionPlanSeedService.js";
import { seedSubscriptionSlugs } from "./services/subscriptionSlugSeedService.js";
import { seedSystemSports } from "./services/systemSportSeedService.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";

dotenv.config();

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

const allowedOrigins = (
  process.env.FRONTEND_URLS ||
  `${process.env.FRONTEND_URL || "http://localhost:5173"}`
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);

app.use(
  compression({
    threshold: 1024,
    level: 6,
  }),
);

const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "10mb";

// Stripe webhooks require the raw body for signature verification (must run before express.json).
app.post(
  "/api/payments/webhook/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));

if (process.env.NODE_ENV !== "production") {
  const slowRequestThresholdMs = Number(process.env.SLOW_API_THRESHOLD_MS || 800);
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      if (elapsedMs >= slowRequestThresholdMs) {
        console.warn(
          `[SLOW API] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${elapsedMs.toFixed(1)}ms`
        );
      }
    });
    next();
  });
}

// ==========================================
// EXISTING ROUTES
// ==========================================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/organizer", organizerRoutes);
app.use("/api/organizers", organizerRoutes);
app.use("/api/player", playerRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/scorer", scorerRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/sports", sportRoutes);
app.use("/api/coaching-sports", coachingSportRoutes);

// ==========================================
// ✨ NEW ROUTES - Academy System
// ==========================================
app.use("/api/academies", academyRoutes);
app.use("/api/coaches", coachRoutes);
app.use("/api/coach", coachRoutes);
app.use("/api/courts", courtRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/pending", pendingRoutes);
app.use("/api/join-requests", joinRequestRoutes);
app.use("/api/player-join-requests", playerJoinRequestRoutes);
app.use("/api/academy-roles", academyRoleRoutes);
app.use("/api/coaching-sessions", coachSessionRoutes);
app.use("/api/coaching-enrollments", coachingEnrollmentRoutes);
app.use("/api/training-plans", trainingPlanRoutes);
app.use("/api/coach-students", coachStudentRoutes);
app.use("/api/coach-teams", coachTeamRoutes);
app.use("/api/coach-payouts", coachPayoutRoutes);
app.use("/api/sport-templates", sportTemplateRoutes);
app.use("/api/court-plans", courtPlanRoutes);
app.use("/api/court-subscriptions", courtSubscriptionRoutes);
app.use("/api/analytics", analyticsRoutes);

// ==========================================
// HEALTH CHECK & ERROR HANDLING
// ==========================================

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Sports Event Management API is running",
    timestamp: new Date().toISOString(),
    features: {
      events: true,
      academies: true,
      coaches: true,
      courts: true,
      bookings: true,
      kyc: true,
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

const PORT = process.env.PORT || 8000;

const httpServer = createServer(app);
const socketCorsOrigins =
  allowedOrigins.length > 0 ? allowedOrigins : [process.env.FRONTEND_URL || "http://localhost:5173"];
const io = new Server(httpServer, {
  path: "/socket.io",
  cors: {
    origin: socketCorsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
setLiveScoreIo(io);

const parseBooleanEnv = (value, fallback = false) => {
  if (value == null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
};

const startServer = async () => {
  await connectDB();
  await migrateUserSportCollection();
  await seedRolesAndPermissions();
  await seedSubscriptionSlugs();
  await seedSubscriptionPlans();

  // Auto-seed system sports on startup (idempotent upsert).
  // Defaults: enabled in development, disabled in production.
  const autoSeedSports = parseBooleanEnv(
    process.env.AUTO_SEED_SPORTS,
    process.env.NODE_ENV !== "production"
  );
  if (autoSeedSports) {
    await seedSystemSports();
  }

  httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║   🏆 CentrePitch Sports Platform                      ║
║   Server running on port ${PORT}                         ║
║   Environment: ${process.env.NODE_ENV || "development"}                            ║
║   API: http://localhost:${PORT}/api                      ║
║   WebSocket: same origin, path /socket.io             ║
║                                                       ║
║   ✅ Events System                                    ║
║   ✅ Academy Management                               ║
║   ✅ Coach System                                     ║
║   ✅ Court Booking                                    ║
╚═══════════════════════════════════════════════════════╝
  `);
  });
};

startServer();

export default app;
