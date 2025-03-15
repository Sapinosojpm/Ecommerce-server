import mongoose from "mongoose";

const regionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  fee: {
    type: Number,
    required: true,
    default: 0, // Default to 0 if no fee is provided
  },
});

const Region = mongoose.model("Region", regionSchema);

export default Region;
