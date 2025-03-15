import mongoose from "mongoose";

// Adjust userId to use ObjectId to reference the user model
const orderSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user', 
    required: false 
  },
  items: { type: Array, required: true },
  amount: { type: Number, required: true },
  address: { type: Object, required: true },
  status: { type: String, required: true, default: 'Order Placed' },
  paymentMethod: { type: String, required: true },
  payment: { type: Boolean, required: true, default: false },
  date: { type: Date, required: true },
  customerName: String,
});

const orderModel = mongoose.models.order || mongoose.model("order", orderSchema);
export default orderModel;
