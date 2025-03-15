import mongoose from "mongoose";

const latestProductSettingSchema = new mongoose.Schema({
    maxDisplay: { type: Number, required: true, default: 10 },
});

export default mongoose.model("LatestProductSetting", latestProductSettingSchema);
