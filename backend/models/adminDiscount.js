import mongoose from "mongoose";

const discountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    discountCode: { type: String, required: true, unique: true },
    discountPercent: { type: Number, required: true },
  },
  { timestamps: true }
  
);

const Discount = mongoose.model("Discount", discountSchema);
export default Discount;
