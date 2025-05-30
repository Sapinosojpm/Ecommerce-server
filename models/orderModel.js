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
 tracking: {
  trackingNumber: String,
  carrierCode: String,
  trackingId: String,
  trackingUrl: String,
  status: {
    type: String,
    enum: ['pending', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'expired'],
    default: 'pending'
  },
  events: [{
    description: String,
    location: String,
    timestamp: Date,
    status: String
  }],
  lastUpdated: Date,
  estimatedDelivery: Date,
  originCountry: String,
  destinationCountry: String
},
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
      'delivered',
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



//   // In orderModel.js, update the items array schema:
// items: [{
//   productId: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
//   name: { type: String, required: true },
//   price: { type: Number, required: true },
//   quantity: { type: Number, required: true },
//   image: { type: String, required: true },
//   variationId: { type: mongoose.Schema.Types.ObjectId },
//   variationDetails: [{
//     variationName: String,
//     optionName: String,
//     priceAdjustment: Number
//   }],
//   returnStatus: { 
//     type: String, 
//     enum: ['none', 'pending', 'approved', 'rejected', 'refunded'],
//     default: 'none'
//   }
// }]