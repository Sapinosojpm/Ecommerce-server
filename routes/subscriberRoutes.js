import express from 'express';
import jwt from 'jsonwebtoken';
import Subscriber from '../models/subscriber.js';
import User from '../models/userModel.js';

const router = express.Router();

router.post('/validate-voucher', async (req, res) => {
    const { voucher } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Unauthorized: No token provided." });
    }

    try {
        // ✅ Verify and decode JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("✅ User ID from token:", decoded.id);

        // ✅ Find user in database
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        console.log("📧 User Email:", user.email);

        // ✅ Find the voucher AND check if user's email is in the allowed list
        const subscriber = await Subscriber.findOne({
            discountCode: voucher,
            email: user.email.toLowerCase()  // ✅ Match the single email field
        });
        

        console.log("🔎 Found subscriber:", subscriber);

        if (!subscriber) {
            console.log("❌ Voucher not found or email not registered:", voucher);
            return res.status(404).json({ success: false, message: 'Invalid voucher or email not registered.' });
        }

        if (!subscriber.isActive) {
            console.log("⛔ Voucher is inactive:", voucher);
            return res.status(403).json({ success: false, message: 'This voucher is inactive.' });
        }

        console.log("✅ Valid Voucher:", subscriber.discountCode, "Discount:", subscriber.discountPercent);
        return res.json({ 
            success: true, 
            discountPercent: subscriber.discountPercent 
        });

    } catch (error) {
        console.error('❌ Error validating voucher:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
