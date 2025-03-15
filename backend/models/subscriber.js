import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    discountCode: {
      type: String,
      required: true,
    },
    discountPercent: { // New field to store the discount percentage
      type: Number,
      default:0,
      required: true,
    },
  },
  { timestamps: true }
);

const Subscriber = mongoose.model('Subscriber', subscriberSchema);
export default Subscriber;
