import mongoose from "mongoose";

const bestSellerSettingSchema = new mongoose.Schema({
    maxDisplay: { type: Number, required: true, default: 10 },
});

export default mongoose.model("BestSellerSetting", bestSellerSettingSchema);
