// controllers/authController.js
import { OAuth2Client } from "google-auth-library";
import userModel from "../models/userModel.js"; // Assuming you have a user model

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Use your Google Client ID

const googleAuth = async (req, res) => {
  const { credential } = req.body;

  try {
    // Verify the Google credential token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    // Check if the user already exists
    let user = await userModel.findOne({ email });
    if (!user) {
      // Create a new user if not found
      user = new userModel({ email, name });
      await user.save();
    }

    // Respond with a success message
    res.json({ success: true, message: "Signed up successfully!" });
  } catch (error) {
    console.error("Google authentication error:", error);
    res.status(400).json({ success: false, message: "Authentication failed" });
  }
};

export { googleAuth };
