import mongoose from "mongoose";

// Adjust userId to use ObjectId to reference the user model
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: false },
  items: { type: Array, required: true },
  amount: { type: Number, required: true },
  address: { type: Object, required: true },
  // status: { type: String, required: true, default: "Order Placed" },
  paymentMethod: { type: String, required: true },
  payment: { type: Boolean, required: true, default: false },
  date: { type: Date, required: true },
  customerName: String,
  voucherAmount: Number,
  voucherCode: String,
  receiptImage: {
    filename: String, // File name
    path: String, // Path to the file
    mimetype: String, // Image type
  },
   status: {
    type: String,
    enum: [
      'Order Placed',
      'Pending', 
      'Processing', 
      'Shipped', 
      'Out for Delivery', 
      'Delivered',
      'Canceled'
    ],
    default: 'Order Placed'
  },
   statusHistory: [{
    status: String,
    changedAt: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  orderNumber: {
    type: String,
    unique: true
  },
}, { 
  timestamps: true 
});


const orderModel = mongoose.models.order || mongoose.model("order", orderSchema);
export default orderModel;
