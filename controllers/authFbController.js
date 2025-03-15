import axios from "axios";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

export const facebookLogin = async (req, res) => {
  const { token } = req.body;

  try {
    // Verify token with Facebook API
    const fbRes = await axios.get(`https://graph.facebook.com/me?access_token=${token}&fields=id,name,email,picture`);
    const { id, name, email, picture } = fbRes.data;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required for Facebook login." });
    }

    // Check if user exists in database
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        facebookId: id,
        name,
        email,
        profilePicture: picture.data.url,
      });
      await user.save();
    }

    // Generate JWT token
    const authToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token: authToken,
      role: user.role || "user",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Facebook Login Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Facebook login failed." });
  }
};
