import axios from "axios";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import VoucherAmountModel from "../models/VoucherAmountModel.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

// Helper function to create a JWT token
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "4h" });
};

// Enhanced version of your loginUser function with detailed CAPTCHA debugging
const loginUser = async (req, res) => {
  try {
    const { email, password, captcha } = req.body;
    
    // Validate required fields
    if (!email || !password || !captcha) {
      return res.status(400).json({ 
        success: false, 
        message: "Email, password, and CAPTCHA are required" 
      });
    }

    // Verify reCAPTCHA for email login
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!secretKey) {
      console.error("RECAPTCHA_SECRET_KEY is not configured");
      return res.status(500).json({
        success: false,
        message: "CAPTCHA configuration error"
      });
    }

    try {
      const captchaResponse = await axios.post(
        "https://www.google.com/recaptcha/api/siteverify",
        null,
        {
          params: { 
            secret: secretKey, 
            response: captcha 
          },
          timeout: 10000 // 10 second timeout
        }
      );

      if (!captchaResponse.data.success) {
        const errorCodes = captchaResponse.data['error-codes'] || [];
        let errorMessage = "CAPTCHA verification failed";
        
        if (errorCodes.includes('missing-input-secret')) {
          errorMessage = "CAPTCHA configuration error: missing secret key";
        } else if (errorCodes.includes('invalid-input-secret')) {
          errorMessage = "CAPTCHA configuration error: invalid secret key";
        } else if (errorCodes.includes('missing-input-response')) {
          errorMessage = "CAPTCHA token missing";
        } else if (errorCodes.includes('invalid-input-response')) {
          errorMessage = "CAPTCHA token invalid or expired";
        } else if (errorCodes.includes('timeout-or-duplicate')) {
          errorMessage = "CAPTCHA token expired or already used";
        } else if (errorCodes.includes('bad-request')) {
          errorMessage = "Invalid CAPTCHA request";
        }
        
        return res.status(400).json({ 
          success: false, 
          message: errorMessage,
          errorCode: errorCodes[0] // Send the first error code for client-side handling
        });
      }

      // Check CAPTCHA score for v3 (if using v3)
      if (captchaResponse.data.score !== undefined && captchaResponse.data.score < 0.5) {
        return res.status(400).json({
          success: false,
          message: "CAPTCHA verification failed: suspicious activity detected"
        });
      }
      
    } catch (captchaError) {
      console.error("CAPTCHA verification request failed:", captchaError.message);
      
      return res.status(400).json({ 
        success: false, 
        message: "CAPTCHA verification service unavailable. Please try again.",
        error: captchaError.message
      });
    }

    // Proceed with email login
    const user = await userModel.findOne({ email }).select('+password');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User doesn't exist" 
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Generate token with 1 hour expiration
    const token = createToken(user._id);
    
    // Prepare user data to return (excluding sensitive info)
    const userData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      cartData: user.cartData || {}
    };

    res.status(200).json({ 
      success: true, 
      token, 
      role: user.role, 
      userId: user._id,
      user: userData
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
};
// Route for user registration
const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    // Validate inputs
    const errors = {};
    if (!validator.isEmail(email)) {
      errors.email = "Please enter a valid email";
    }
    if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone)) {
      errors.phone = "Invalid phone number format";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    // Check for existing user
    const existingUser = await userModel.findOne({
      $or: [{ email }, ...(phone ? [{ phone }, { tempPhone: phone }] : [])],
    });

    if (existingUser) {
      const errors = {};
      if (existingUser.email === email) errors.email = "Email already exists";
      if (
        phone &&
        (existingUser.phone === phone || existingUser.tempPhone === phone)
      ) {
        errors.phone = "Phone number already exists";
      }
      return res.status(400).json({ success: false, errors });
    }

    // Only proceed with OTP verification - don't save user yet
    if (phone) {
      return res.status(200).json({ 
        success: true,
        needsVerification: true,
        tempUserData: {
          _id: new mongoose.Types.ObjectId(),
          firstName,
          lastName,
          email,
          password: await bcrypt.hash(password, 10),
          phone
        },
        message: 'Please verify your phone number'
      });
    }
    
    // If no phone verification needed, create and save user
    const user = new userModel({
      firstName,
      lastName,
      email,
      password: await bcrypt.hash(password, 10),
      role: "user",
      registrationComplete: true,
    });

    await user.save();

    const token = createToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        registrationComplete: true,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

// Finalize registration
const finalizeRegistration = async (req, res) => {
  try {
    const { tempUserData } = req.body;

    const existingUser = await userModel.findOne({ email: tempUserData.email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = new userModel({
      ...tempUserData,
      registrationComplete: true,
      phoneVerified: true,
      role: "user",
    });

    await user.save();

    await verifyUserPhone(user._id);

    const token = createToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        phoneVerified: true,
      },
    });
  } catch (error) {
    console.error("Finalize registration error:", error);
    res.status(500).json({
      success: false,
      message: "Finalize registration failed",
      error: error.message
    });
  }
};

// Verify user phone
const verifyUserPhone = async (userId) => {
  try {
    const updatedUser = await userModel.findByIdAndUpdate(
      userId, 
      { 
        phoneVerified: true, 
        verified: true
      },
      { new: true }
    );
    console.log('User verification status updated:', updatedUser);
  } catch (error) {
    console.error('Error updating verification status:', error);
  }
};

// Complete registration
const completeRegistration = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    const existingUser = await userModel.findOne({
      $or: [{ email }, { phone }, { tempPhone: phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone already registered',
      });
    }

    const user = new userModel({
      firstName,
      lastName,
      email,
      password,
      phone,
      phoneVerified: true,
      registrationComplete: true,
      role: 'user',
    });

    await user.save();

    const token = createToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        phoneVerified: true,
      },
    });
  } catch (error) {
    console.error("Registration completion failed:", error);
    res.status(500).json({
      success: false,
      message: "Registration completion failed",
      error: error.message,
    });
  }
};

// Admin login
const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

if (user.role !== "admin" && user.role !== "staff") {
  return res.status(403).json({ success: false, message: "Access denied" });
}


    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }


    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );
    res.json({ success: true, token,role: user.role, });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find();
    res.json({ success: true, users });
  } catch (error) {
    console.error("Get users error:", error);
    res.json({ success: false, message: "Failed to fetch users" });
  }
};

// Change user role
const changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminId = req.user.id;

    if (!["user", "admin", "staff"].includes(role)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid role provided" });
    }

    const admin = await userModel.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (String(userId) === String(adminId) && role !== "admin") {
      return res
        .status(400)
        .json({ success: false, message: "You cannot change your own role" });
    }

    user.role = role;
    await user.save();

    res.json({ success: true, message: `User role updated to ${role}` });
  } catch (error) {
    console.error("Error changing user role:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// NEW: Update user permissions
// Update user permissions
const updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { permissions },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'Permissions updated successfully', 
      user: updatedUser 
    });
  } catch (error) {
    console.error("Error updating permissions:", error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating permissions',
      error: error.message
    });
  }
};


// NEW: Get user profile with permissions
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userModel.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ 
      success: true, 
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        permissions: user.permissions || {},
        phone: user.phone,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export {
  loginUser,
  registerUser,
  getAllUsers,
  changeUserRole,
  adminLogin,
  completeRegistration,
  updateUserPermissions,
  getUserProfile,
  createToken,
  finalizeRegistration
};