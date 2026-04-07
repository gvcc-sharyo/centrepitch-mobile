import dotenv from "dotenv";
import mongoose from "mongoose";
import { seedSystemSports } from "./services/systemSportSeedService.js";

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/sports_event_management";

const run = async () => {
  if (!mongoUri) {
    console.error("MONGODB_URI (or MONGO_URI) is required.");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  await seedSystemSports();

  await mongoose.disconnect();
  console.log("Disconnected.");
};

run().catch(async (error) => {
  console.error("Seed failed:", error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // no-op
  }
  process.exit(1);
});

