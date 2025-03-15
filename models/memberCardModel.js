import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: false }, // Changed to String
    date: { type: Number, required: true }
});

const memberCardModel = mongoose.models.member || mongoose.model("memberCard", memberSchema);

export default memberCardModel;
