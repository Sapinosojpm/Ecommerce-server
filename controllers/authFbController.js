import axios from "axios";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/userModel.js";

// Helper function to create JWT token
const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Facebook login handler
export const facebookLogin = async (req, res) => {
  const { token, email, name, facebookId } = req.body;

  try {
    // Verify token with Facebook API
    const fbRes = await axios.get(`https://graph.facebook.com/me?access_token=${token}&fields=id,name,email,picture`);
    const { id, email: fbEmail, name: fbName, picture } = fbRes.data;

    if (!fbEmail) {
      return res.status(400).json({ success: false, message: "Email is required for Facebook login." });
    }

    // Check if user exists in database
    let user = await User.findOne({ 
      $or: [
        { email: fbEmail },
        { facebookId: id }
      ]
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "No account found with this Facebook account. Please sign up first." 
      });
    }

    // Update user's Facebook ID if not set
    if (!user.facebookId) {
      user.facebookId = id;
      await user.save();
    }

    // Generate JWT token
    const authToken = createToken(user._id);

    res.json({
      success: true,
      token: authToken,
      role: user.role || "user",
      userId: user._id,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePicture: user.profilePicture,
        phone: user.phone,
        phoneVerified: user.phoneVerified
      },
    });
  } catch (error) {
    console.error("Facebook Login Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Facebook login failed." });
  }
};

// Facebook signup handler
export const facebookSignup = async (req, res) => {
  const { token, email, name, password, facebookId } = req.body;

  try {
    // Verify token with Facebook API
    const fbRes = await axios.get(`https://graph.facebook.com/me?access_token=${token}&fields=id,name,email,picture`);
    const { id, email: fbEmail, name: fbName, picture } = fbRes.data;

    if (!fbEmail) {
      return res.status(400).json({ success: false, message: "Email is required for Facebook signup." });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: fbEmail },
        { facebookId: id }
      ]
    });

    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: "An account with this email already exists. Please try logging in instead." 
      });
    }

    // Split name into first and last name
    const nameParts = fbName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email: fbEmail,
      password: await bcrypt.hash(password, 10),
      facebookId: id,
      profilePicture: picture?.data?.url,
      role: "user",
      registrationComplete: true
    });

    await user.save();

    // Generate JWT token
    const authToken = createToken(user._id);

    res.status(201).json({
      success: true,
      token: authToken,
      role: user.role,
      userId: user._id,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePicture: user.profilePicture
      },
    });
  } catch (error) {
    console.error("Facebook Signup Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Facebook signup failed." });
  }
};
