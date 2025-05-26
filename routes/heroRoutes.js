import express from 'express';
import upload from '../middleware/multer.js';
import Hero from '../models/heroModel.js';

const router = express.Router();

// PUT /api/hero — update or create hero section
router.put(
  '/hero',
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  async (req, res) => {
    try {
      console.log('Request received:', {
        body: req.body,
        files: req.files,
      });

      if (!req.body.title || !req.body.subtitle) {
        return res.status(400).json({ message: 'Title and subtitle are required' });
      }

      const updateData = {
        title: req.body.title,
        subtitle: req.body.subtitle,
        type: req.body.type || 'image',
      };

      // Normalize paths to start with a slash and use forward slashes
      if (req.files?.image?.[0]) {
        updateData.image = '/' + req.files.image[0].path.replace(/\\/g, '/');
        console.log('Image uploaded:', updateData.image);
      }

      if (req.files?.video?.[0]) {
        updateData.video = '/' + req.files.video[0].path.replace(/\\/g, '/');
        console.log('Video uploaded:', updateData.video);
      }

      const hero = await Hero.findOneAndUpdate({}, updateData, {
        new: true,
        upsert: true,
      });

      res.status(200).json(hero);
    } catch (error) {
      console.error('Detailed error:', {
        message: error.message,
        stack: error.stack,
        fullError: error,
      });
      res.status(500).json({
        message: 'Failed to update hero section',
        error: error.message,
      });
    }
  }
);

// GET /api/hero — fetch current hero section
router.get('/hero', async (req, res) => {
  try {
    const hero = await Hero.findOne({});
    res.status(200).json(hero);
  } catch (error) {
    console.error('Error fetching hero data:', error);
    res.status(500).json({ message: 'Failed to fetch hero data.', error });
  }
});

export default router;
