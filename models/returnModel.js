import mongoose from "mongoose";

const returnSchema = new mongoose.Schema({
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "order", 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  itemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  reason: { 
    type: String, 
    required: true,
    enum: [
      'damaged',
      'defective',
      'wrong_item',
      'not_as_described',
      'size_issue',
      'changed_mind',
      'other'
    ]
  },
  description: { 
    type: String, 
    required: true 
  },
  images: [{
    filename: String,
    path: String,
    mimetype: String
  }],
  status: { 
    type: String, 
    default: 'pending',
    enum: [
      'pending',
      'approved',
      'rejected',
      'processing',
      'refunded',
      'completed'
    ]
  },
  refundAmount: { 
    type: Number, 
    default: 0 
  },
  refundMethod: { 
    type: String,
    enum: [
      'original_payment',
      'store_credit',
      'bank_transfer',
      'gcash',
      'none'
    ]
  },
  adminNotes: String,
  statusHistory: [{
    status: String,
    changedAt: {
      type: Date,
      default: Date.now
    },
    notes: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user"
    }
  }],
  returnShipping: {
    trackingNumber: String,
    carrier: String,
    cost: Number,
    paidBy: {
      type: String,
      enum: ['customer', 'merchant']
    }
  }
}, { 
  timestamps: true 
});

const Return = mongoose.models.return || mongoose.model("return", returnSchema);
export default Return;