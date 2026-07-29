import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    console.log("MongoDB already connected");
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI);
    isConnected = db.connections[0].readyState === 1;
    console.log("Connected to MongoDB:", db.connection.host);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw new Error("MongoDB connection failed!");
  }
};
