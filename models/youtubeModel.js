// backend/models/youtubeModel.js
import mongoose from "mongoose";

const youtubeSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
});

// The collection will hold only one document for settings.
export const Youtube = mongoose.model("Youtube", youtubeSchema);
