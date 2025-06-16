import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import dotenv from "dotenv";

dotenv.config();

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google authentication handler
export const googleAuth = async (req, res) => {
  const { token: googleToken, isSignUp } = req.body;

  try {
    if (!googleToken) {
      return res
        .status(400)
        .json({ success: false, message: "Google token is required!" });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, given_name, family_name, sub: googleId, picture } = payload;

    // Check if user exists
    let user = await userModel.findOne({ 
      $or: [
        { email },
        { googleId }
      ]
    });

    // Handle signup flow
    if (isSignUp) {
      if (user) {
        return res.status(409).json({ 
          success: false, 
          message: "An account with this email already exists. Please try logging in instead." 
        });
      }

      // Create new user
      user = new userModel({
        firstName: given_name,
        lastName: family_name,
        email,
        googleId,
        profilePicture: picture,
        role: "user",
        isVerified: true, // Google accounts are pre-verified
      });

      await user.save();
    } else {
      // Handle login flow
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account found. Please sign up first."
        });
      }

      // Update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    }

    // Generate JWT token
    const authToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token: authToken,
      role: user.role,
      userId: user._id,
      isNewUser: isSignUp,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    console.error("Google authentication error:", error);
    
    if (error.message.includes("Wrong recipient")) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google Client ID configuration. Please contact support."
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to authenticate with Google. Please try again."
    });
  }
}; 