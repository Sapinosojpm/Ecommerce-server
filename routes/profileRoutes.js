import express from 'express';
import authUser from '../middleware/auth.js'; // Middleware to authenticate user
import User from '../models/userModel.js'; // User model
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profile_pictures',
    resource_type: 'image'
  }
});

const upload = multer({ storage: storage });

const router = express.Router();

// GET: Fetch user details
router.get('/profile', authUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId); // Use req.userId from auth middleware
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json(user); // ✅ Return user data
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST: Upload profile picture
router.post('/profile/upload', authUser, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId, // Use req.userId
      { profilePicture: req.file.path },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      message: 'Profile picture uploaded successfully',
      profilePictureUrl: req.file.path
    });
  } catch (error) {
    console.error('❌ Error uploading profile picture:', error);
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
      req.userId, // Use req.userId
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
