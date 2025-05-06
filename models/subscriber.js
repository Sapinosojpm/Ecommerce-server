import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema(
  {
    email: {  // ✅ Changed from `email` (string) to `emails` (array)
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    discountCode: {
      type: String,
      required: true,
    },
    discountPercent: { 
      type: Number,
      default: 0,
      required: true,
    },
    isActive: {  
      type: Boolean,
      default: true,
    },
    usedAt: { 
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Subscriber = mongoose.model('Subscriber', subscriberSchema);
export default Subscriber;
