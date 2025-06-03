import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    // Add these fields to your userSchema
    resetEmailOTP: String,
    resetEmailOTPExpires: Date,
    isOTPVerified: Boolean,
    phone: {
      type: String,
      unique: true,
      sparse: true, // This allows multiple null values
      default: null, // Explicitly set null as default
      validate: {
        validator: v => !v || /^\+?[1-9]\d{1,14}$/.test(v), // Allow empty/null
        message: 'Invalid phone number format'
      }
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },
    tempPhone: {  // Stores phone during verification process
      type: String,
      validate: {
        validator: v => /^\+?[1-9]\d{1,14}$/.test(v),
        message: 'Invalid phone number format'
      }
    },
    phoneVerificationCode: String,
    phoneVerificationExpires: Date,
   
    street: { type: String },
    region: { type: String },
    barangay: { type: String },
    city: { type: String },
    province: { type: String },
    postalCode: { type: String },
    cartData: { 
      type: Object,
      of: {
        quantity: { type: Number, required: true },
        variations: { 
          type: Object, 
          of: String // Variations can be key-value pairs (e.g., color: "red")
        }
      },
      default: {}
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    googleId: { type: String, default: null },
    facebookId: { type: String, unique: true, sparse: true },
    profilePicture: { type: String },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    role: { type: String, enum: ["user", "admin", "staff"], default: "user" },
    isAvailable: { type: Boolean, default: false },
    verified: { type: Boolean, default: false }, // Added for phone verification
    registrationComplete: { type: Boolean, default: false }, // Added for step registration
    
    // NEW: Role-based permissions
    permissions: {
      type: Object,
      default: {
        // Main Menu permissions
        dashboard: true,
        addItems: false,
        listItems: true,
        orders: true,
        returns: false,
        users: false,
        adminLiveChat: false,
        
        // E-commerce permissions
        askDiscount: false,
        voucherAmount: false,
        category: false,
        regionFee: false,
        feeKilo: false,
        deals: true,
        
        // Content permissions
        homepage: false,
        aboutPage: false,
        contactPage: false,
        popupManager: false,
        portfolio: false
      }
    },
    
    claimedVouchers: [
      {
        voucher: { type: mongoose.Schema.Types.ObjectId, ref: "VoucherAmount" },
        voucherCode: { type: String, required: true },
        voucherAmount: { type: Number, required: true },
        voucherMinPurchase: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
      }
    ],
  },
  
  { 
    minimize: false,
    timestamps: true // Added timestamps for better tracking
  }
);

// Pre-save middleware to set admin permissions
userSchema.pre('save', function(next) {
  if (this.role === 'admin') {
    // Admins get all permissions by default
    this.permissions = {
      // Main Menu permissions
      dashboard: true,
      addItems: true,
      listItems: true,
      orders: true,
      returns: true,
      users: true,
      adminLiveChat: true,
      
      // E-commerce permissions
      askDiscount: true,
      voucherAmount: true,
      category: true,
      regionFee: true,
      feeKilo: true,
      deals: true,
      
      // Content permissions
      homepage: true,
      aboutPage: true,
      contactPage: true,
      popupManager: true,
      portfolio: true
    };
  } else if (this.isNew && this.role === 'user') {
    // Set default user permissions only for new users
    this.permissions = {
      // Main Menu permissions
      dashboard: true,
      addItems: false,
      listItems: true,
      orders: true,
      returns: false,
      users: false,
      adminLiveChat: false,
      
      // E-commerce permissions
      askDiscount: false,
      voucherAmount: false,
      category: false,
      regionFee: false,
      feeKilo: false,
      deals: true,
      
      // Content permissions
      homepage: false,
      aboutPage: false,
      contactPage: false,
      popupManager: false,
      portfolio: false
    };
  }
  next();
});

const userModel = mongoose.models.User || mongoose.model("User", userSchema);
export default userModel;