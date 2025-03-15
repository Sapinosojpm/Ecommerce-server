import mongoose from "mongoose";

const introSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: false },
    video: { type: String, required: false }, // New field for video storage
    date: { type: Number, required: true }
});

const introModel = mongoose.models.intro || mongoose.model("intro", introSchema);

export default introModel;

