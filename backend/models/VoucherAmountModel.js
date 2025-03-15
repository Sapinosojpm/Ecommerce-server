import mongoose from "mongoose";

const VoucherAmountSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true },
    voucherAmount: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    expirationDate: { type: Date },
    minimumPurchase: { type: Number, default: 0 }
});

const VoucherAmountModel = mongoose.model("VoucherAmount", VoucherAmountSchema);

export default VoucherAmountModel;
