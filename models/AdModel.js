import mongoose from "mongoose";

const adSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  link: { type: String, required: true },
  isActive: { type: Boolean, default: true },
});

export const AdModel = mongoose.model("Ad", adSchema);
