import Hero from '../models/heroModel.js';
// REMOVE: import { v2 as cloudinary } from 'cloudinary';
import { protect, admin } from '../middleware/adminAuth.js';

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

    const { title, subtitle, type, image, video } = req.body;
    const updateData = { title, subtitle, type };

    // Save new S3 URLs if provided
    if (type === 'image' && image) {
      updateData.image = image;
      updateData.video = null;
    }
    if (type === 'video' && video) {
      updateData.video = video;
      updateData.image = null;
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