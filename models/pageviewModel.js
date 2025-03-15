import mongoose from "mongoose";

const pageViewSchema = new mongoose.Schema({
  page: { type: String, required: true },
  userId: { type: String, default: "guest" }, // Stores user ID or "guest"
  sessionId: { type: String }, // Unique session ID to prevent duplicate counts
  timestamp: { type: Date, default: Date.now }, // Track when view happened
});

export default mongoose.model("PageView", pageViewSchema);
