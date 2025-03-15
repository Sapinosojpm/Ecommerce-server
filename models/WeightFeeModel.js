import mongoose from "mongoose";

const shippingFeeSchema = new mongoose.Schema({
  perKilo: { type: Number, required: true, default: 100 },
});

export default mongoose.model("ShippingFee", shippingFeeSchema);
