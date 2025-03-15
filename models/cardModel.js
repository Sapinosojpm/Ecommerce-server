import mongoose from "mongoose";

const cardSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: false }, // Changed to String
    date: { type: Number, required: true }
});

const cardModel = mongoose.models.card || mongoose.model("card", cardSchema);

export default cardModel;
