import express from 'express';
import Subscriber from '../models/subscriber.js';

const router = express.Router();

// API to verify and get voucher details
router.post('/validate-voucher', async (req, res) => {
    const { voucher } = req.body;
    console.log("🔍 Voucher received:", voucher); // Debugging

    try {
        const subscriber = await Subscriber.findOne({ discountCode: voucher });

        if (!subscriber) {
            console.log("❌ Voucher not found:", voucher);
            return res.status(404).json({ success: false, message: 'Invalid or expired voucher' });
        }

        console.log("✅ Voucher found:", subscriber.discountCode, "Discount:", subscriber.discountPercent);
        res.json({ 
            success: true, 
            discountPercent: subscriber.discountPercent 
        });

    } catch (error) {
        console.error('❌ Error validating voucher:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


export default router;
