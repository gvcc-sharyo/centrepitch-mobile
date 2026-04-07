import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Player from "../models/Player.js";

dotenv.config();

const main = async () => {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/sports_event_management";
  await mongoose.connect(mongoUri);

  console.log("Connected. Syncing User + Player indexes...");
  await User.syncIndexes();
  await Player.syncIndexes();
  console.log("Index sync complete.");

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error("Failed to sync indexes:", err.message);
  await mongoose.disconnect();
  process.exit(1);
});
