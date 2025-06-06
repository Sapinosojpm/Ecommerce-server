import axios from "axios";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import { OAuth2Client } from "google-auth-library";
import VoucherAmountModel from "../models/VoucherAmountModel.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

// Helper function to create a JWT token
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "4h" });
};

// Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
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

    // DEBUG: Log CAPTCHA details
    console.log("=== CAPTCHA DEBUG ===");
    console.log("CAPTCHA token received:", captcha?.substring(0, 20) + "...");
    console.log("Secret key exists:", !!process.env.RECAPTCHA_SECRET_KEY);
    console.log("Secret key starts with:", process.env.RECAPTCHA_SECRET_KEY?.substring(0, 10) + "...");
    
    // Verify reCAPTCHA for email login
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
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

      // DEBUG: Log full CAPTCHA response
      console.log("Google CAPTCHA response:", captchaResponse.data);
      console.log("CAPTCHA success:", captchaResponse.data.success);
      console.log("CAPTCHA error codes:", captchaResponse.data['error-codes']);
      console.log("CAPTCHA score:", captchaResponse.data.score); // For v3
      console.log("=====================");

      if (!captchaResponse.data.success) {
        // More detailed error based on Google's error codes
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
        }
        
        console.error("CAPTCHA verification failed with codes:", errorCodes);
        return res.status(400).json({ 
          success: false, 
          message: errorMessage,
          debug: {
            errorCodes: errorCodes,
            captchaResponse: captchaResponse.data
          }
        });
      }
      
    } catch (captchaError) {
      console.error("CAPTCHA verification request failed:", captchaError.message);
      console.error("CAPTCHA error details:", {
        code: captchaError.code,
        response: captchaError.response?.data,
        status: captchaError.response?.status
      });
      
      return res.status(400).json({ 
        success: false, 
        message: "CAPTCHA verification service unavailable",
        debug: {
          error: captchaError.message,
          code: captchaError.code
        }
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
      cartData: user.cartData || {} // Ensure cartData is always returned as object
    };

    res.status(200).json({ 
      success: true, 
      token, 
      role: user.role, 
      userId: user._id,
      user: userData // Include complete user data
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
export const finalizeRegistration = async (req, res) => {
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

// Google login handler
const googleLogin = async (req, res) => {
  const { token } = req.body;

  try {
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Google token is required!" });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    let user = await userModel.findOne({ email: payload.email });

    if (!user) {
      user = new userModel({
        firstName: payload.given_name,
        lastName: payload.family_name,
        email: payload.email,
        googleId: payload.sub,
        profilePicture: payload.picture,
        role: "user",
        registrationComplete: true,
      });
      await user.save();
    }

    const authToken = createToken(user._id);
    res.json({ success: true, token: authToken, role: user.role, userId: user._id });
  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(400).json({ success: false, message: "Google login failed!" });
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
  googleLogin,
  changeUserRole,
  adminLogin,
  completeRegistration,
  updateUserPermissions, // NEW
  getUserProfile, // NEW
  createToken,
};