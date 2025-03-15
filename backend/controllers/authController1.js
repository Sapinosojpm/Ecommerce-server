import { OAuth2Client } from "google-auth-library";
import User from "../models/userModel.js";
import dotenv from "dotenv";

dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req, res) => {
    const { token } = req.body;

    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { sub, name, email, picture } = ticket.getPayload();

        let user = await User.findOne({ googleId: sub });

        if (!user) {
            user = new User({ googleId: sub, name, email, picture });
            await user.save();
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error("Google Authentication Error:", error);
        res.status(401).json({ success: false, message: "Invalid token" });
    }
};
