import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    phone: { type: String },
    street: { type: String },
    region: { type: String },
    barangay: { type: String },
    city: { type: String },
    province: { type: String },
    postalCode: { type: String },
    cartData: { type: Object, default: {} },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    googleId: { type: String, default: null },
    facebookId: { type: String, unique: true, sparse: true },
    profilePicture: { type: String },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    role: { type: String, enum: ["user", "admin"], default: "user" }, 
    
    // ✅ STORE CLAIMED VOUCHERS
    claimedVouchers: [{ type: mongoose.Schema.Types.ObjectId, ref: "VoucherAmount" }], 

  },
  { minimize: false }
);

const userModel = mongoose.models.User || mongoose.model("User", userSchema);
export default userModel;
