import express from 'express';
import authUser from '../middleware/auth.js'; // Middleware to authenticate user
import User from '../models/userModel.js'; // User model

const router = express.Router();

// GET: Fetch user details
router.get('/profile', authUser, async (req, res) => {
  try {
    const user = await User.findById(req.body.userId); // ✅ Use `req.user.id` from auth middleware
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json(user); // ✅ Return user data
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT: Update user details
router.put('/profile', authUser, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, street, barangay, city, province, postalCode, region } = req.body;

    // ✅ Ensure region is stored as a string
    const updatedData = {
      firstName,
      lastName,
      email,
      phone,
      street,
      barangay,
      city,
      province,
      postalCode,
      region: String(region), // 🔹 Convert to string if necessary
    };

    const user = await User.findByIdAndUpdate(
      req.body.userId, // ✅ Use `req.user.id`
      updatedData,
      { new: true } // ✅ Return updated document
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log("✅ Updated User Data:", user); // Debugging

    return res.status(200).json(user); // ✅ Return updated user data
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
