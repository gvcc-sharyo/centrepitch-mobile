import mongoose from 'mongoose';

const toNumberOrDefault = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/centre_pitch', {
      maxPoolSize: toNumberOrDefault(process.env.MONGO_MAX_POOL_SIZE, 30),
      minPoolSize: toNumberOrDefault(process.env.MONGO_MIN_POOL_SIZE, 5),
      maxIdleTimeMS: toNumberOrDefault(process.env.MONGO_MAX_IDLE_MS, 30000),
      serverSelectionTimeoutMS: toNumberOrDefault(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 5000),
      socketTimeoutMS: toNumberOrDefault(process.env.MONGO_SOCKET_TIMEOUT_MS, 45000),
      connectTimeoutMS: toNumberOrDefault(process.env.MONGO_CONNECT_TIMEOUT_MS, 10000),
      family: 4,
      autoIndex: process.env.NODE_ENV !== 'production',
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
