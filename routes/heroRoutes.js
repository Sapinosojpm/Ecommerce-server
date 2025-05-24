import express from 'express';
import upload from '../middleware/multer.js';
import Hero from '../models/heroModel.js';

const router = express.Router();

router.put(
  '/hero',
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  async (req, res) => {
    try {
      const { title, subtitle, type } = req.body;

      const image = req.files?.image?.[0]?.path;
      const video = req.files?.video?.[0]?.path;

      const hero = await Hero.findOneAndUpdate(
        {},
        {
          title,
          subtitle,
          type,
          ...(image && { image }),
          ...(video && { video }),
        },
        { new: true, upsert: true }
      );

      res.status(200).json(hero);
    } catch (error) {
      console.error('Error updating hero section:', error);
      res.status(500).json({ message: 'Failed to update hero section.', error });
    }
  }
);

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
