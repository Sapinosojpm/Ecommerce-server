import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rating: { type: Number, required: true },
  review: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("Review", reviewSchema);
