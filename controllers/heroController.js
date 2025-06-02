import Hero from '../models/heroModel.js';
import { v2 as cloudinary } from 'cloudinary';
import { protect, admin } from '../middleware/adminAuth.js';

// Configure Cloudinary (should be in a separate config file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = async (file, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      resource_type: resourceType,
      folder: 'hero_uploads',
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload file to Cloudinary');
  }
};
// Get hero section
export const getHero = async (req, res) => {
  try {
    const hero = await Hero.findOne();
    if (!hero) {
      return res.status(404).json({ success: false, message: 'Hero section not found' });
    }
    res.status(200).json(hero);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
// Update hero section
export const updateHero = async (req, res) => {
  try {
    // Verify admin access
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { title, subtitle, type } = req.body;
    const updateData = { title, subtitle, type };

    // Handle file uploads
    if (req.files?.image) {
      updateData.image = await uploadToCloudinary(req.files.image[0]);
    }
    if (req.files?.video) {
      updateData.video = await uploadToCloudinary(req.files.video[0], 'video');
    }

    // Validate required fields
    if (!title || !subtitle) {
      return res.status(400).json({
        success: false,
        message: 'Title and subtitle are required',
      });
    }

    // Find and update or create new hero section
    const hero = await Hero.findOneAndUpdate(
      {},
      updateData,
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Hero section updated successfully',
      data: hero,
    });
  } catch (error) {
    console.error('Error updating hero section:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating hero section',
      error: error.message,
    });
  }
};