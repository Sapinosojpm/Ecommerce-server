// models/Deal.js
import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    discount: { type: Number, required: true },
    imageUrl: { type: String, required: false },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const Deal = mongoose.model('Deal', dealSchema);
export default Deal;
