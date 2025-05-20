import express from 'express';
import multer from 'multer';
import Hero from '../models/heroModel.js';
import path from 'path';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

router.put('/hero', upload.fields([{ name: 'image' }, { name: 'video' }]), async (req, res) => {
  try {
    const { title, subtitle, type } = req.body;
    const image = req.files?.image?.[0] ? `/uploads/${req.files.image[0].filename}` : undefined;
    const video = req.files?.video?.[0] ? `/uploads/${req.files.video[0].filename}` : undefined;

    const hero = await Hero.findOneAndUpdate(
      {},
      { title, subtitle, type, ...(image && { image }), ...(video && { video }) },
      { new: true, upsert: true }
    );

    res.status(200).json(hero);
  } catch (error) {
    console.error('Error updating hero section:', error);
    res.status(500).json({ message: 'Failed to update hero section.', error });
  }
});

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
