import mongoose from "mongoose";

const locationSchema = mongoose.Schema({
  name: { type: String, required: true, default: "Default Location" },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
});

export default mongoose.model("Location", locationSchema);
