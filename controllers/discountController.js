import Subscriber from '../models/subscriber.js'; // Import the Subscriber model
import Order from '../models/orderModel.js'; // Import the Order model

// ✅ Validate Discount Code
export const validateDiscount = async (req, res) => {
    try {
        console.log("📥 Request Body:", req.body);

        const { email, discountCode } = req.body;

        if (!email || !discountCode) {
            return res.json({ success: false, message: '❌ Email and discount code are required' });
        }

        console.log(`🔍 Searching for discountCode=${discountCode}, email=${email}`);

        // ✅ Find the subscriber using email only
        console.log("🔍 Searching for email:", email);
        console.log("🔍 Searching for discountCode:", discountCode);

        const allSubscribers = await Subscriber.find({ email: email.toLowerCase() });
        console.log("📜 All Subscriber Entries for this Email:", allSubscribers);

        const subscriber = await Subscriber.findOne({
            email: email.toLowerCase(),
            discountCode: { $regex: new RegExp("^" + discountCode + "$", "i") } // Case-insensitive match
        });

        console.log("🔎 Subscriber Found:", subscriber);

        if (!subscriber) {
            return res.json({ success: false, message: '❌ Invalid or expired discount code' });
        }

        const discountPercent = subscriber.discountPercent || 0;

        // ✅ Check if the user has already used this specific discount
        const existingOrder = await Order.findOne({ 
            email: email.toLowerCase(),
            discountCode: discountCode, // Ensure it's the same discount
            status: { $in: ["Completed", "Paid"] } 
        });

        console.log("🛒 Existing Order Found:", existingOrder);

        if (existingOrder) {
            return res.json({ success: false, message: '❌ Discount code is no longer valid as an order has been placed' });
        }

        const responseData = {
            success: true,
            message: '✅ Discount code is valid',
            discountCode,
            discountPercent,
        };

        console.log("📤 Sending Response:", JSON.stringify(responseData, null, 2));
        return res.json(responseData);

    } catch (error) {
        console.error('❌ Error validating discount code:', error);
        res.status(500).json({ success: false, message: '❌ Internal server error' });
    }
};

// ✅ Add Discount for a Subscriber
export const addDiscount = async (req, res) => {
    try {
        console.log("📥 Request Body:", req.body);

        const { email, discountCode, discountPercent } = req.body;

        if (!email || !discountCode) {
            return res.json({ success: false, message: '❌ Email and discount code are required' });
        }

        console.log(`🔹 Adding discount for: ${email} | Code: ${discountCode}`);

        // ✅ Check if the user is already a subscriber with a discount
        const existingSubscriber = await Subscriber.findOne({ email: email.toLowerCase() });

        if (existingSubscriber) {
            return res.json({ success: false, message: '❌ Subscriber already has a discount code' });
        }

        // ✅ Create a new subscriber with a discount
        const newSubscriber = new Subscriber({
            email: email.toLowerCase(), // Store email in lowercase
            discountCode: discountCode.trim(), // Trim to avoid accidental spaces
            discountPercent: discountPercent || 0, // Default to 0 if not provided
        });

        await newSubscriber.save();
        console.log("✅ Discount assigned:", newSubscriber);

        res.json({
            success: true,
            message: '✅ Discount assigned to subscriber',
            subscriber: newSubscriber
        });

    } catch (error) {
        console.error('❌ Error adding discount:', error);
        res.status(500).json({ success: false, message: '❌ Internal server error' });
    }
};
