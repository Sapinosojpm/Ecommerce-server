import mongoose from "mongoose";

// 📦 TrackingMore-compatible tracking event schema
const trackingEventSchema = new mongoose.Schema(
  {
    status: String,
    details: String, // full event description (like "Arrived at facility - Manila")
    location: String,
    timestamp: Date,
  },
  { _id: false }
);

// 📘 Order status history (internal status logs)
const statusHistorySchema = new mongoose.Schema(
  {
    status: String,
    changedAt: { type: Date, default: Date.now },
    notes: String,
  },
  { _id: false }
);

// 📦 Tracking info schema (for TrackingMore)
const trackingSchema = new mongoose.Schema(
  {
    trackingNumber: { type: String, index: true },
    courierCode: String, // from TrackingMore: "jtexpress-ph", "lbc", etc.
    status: {
      type: String,
      enum: [
        "pending",
        "notfound",
        "transit",
        "pickup",
        "delivered",
        "undelivered",
        "exception",
        "expired",
      ],
      default: "pending",
    },
    lastEvent: String,
    events: [trackingEventSchema], // from TrackingMore → origin_info.trackinfo
    originCountry: String,
    destinationCountry: String,
    lastUpdated: Date,
    estimatedDelivery: Date,
    trackingId: String,
    trackingUrl: String,
  },
  { _id: false }
);

// 🧾 Receipt image (if any)
const receiptImageSchema = new mongoose.Schema(
  {
    filename: String,
    path: String,
    mimetype: String,
  },
  { _id: false }
);

// 📦 Order schema
const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: false },
    items: { type: Array, required: true },
    amount: { type: Number, required: true },
    address: { type: Object, required: true },

    paymentMethod: { type: String, required: true },
    payment: { type: Boolean, default: false },

    date: { type: Date, required: true },

    customerName: String,
    voucherAmount: Number,
    voucherCode: String,

    tracking: trackingSchema, // ✅ updated for TrackingMore

    receiptImage: receiptImageSchema,

    status: {
      type: String,
      enum: [
        "Order Placed",
        "Packing",
        "Pending",
        "Processing",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Canceled",
      ],
      default: "Order Placed",
    },

    statusHistory: [statusHistorySchema],

    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },

    shippingFee: { type: Number, default: 0 },
    regionFee: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 🔍 Indexes
orderSchema.index({ "tracking.trackingNumber": 1 });
orderSchema.index({ "tracking.courierCode": 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

const orderModel = mongoose.models.order || mongoose.model("order", orderSchema);

export default orderModel;
