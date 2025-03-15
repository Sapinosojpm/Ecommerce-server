import express from 'express';
import multer from 'multer';
import Hero from '../models/heroModel.js';
import path from 'path';

// Initialize router
const router = express.Router();

// Configure multer to handle file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');  // Directory to store uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);  // Generate unique filename
  },
});

const upload = multer({ storage });

// Update hero data with image upload
router.put('/hero', upload.single('image'), async (req, res) => {
  try {
    const { title, subtitle } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : undefined; // Set image path

    const hero = await Hero.findOneAndUpdate(
      {},  // Empty filter to update the first document
      { title, subtitle, image },  // Update the fields
      { new: true, upsert: true }  // Create new document if it doesn't exist
    );

    res.status(200).json(hero); // Respond with updated hero data
  } catch (error) {
    console.error('Error updating hero section:', error);
    res.status(500).json({ message: 'Failed to update hero section.', error });
  }
});

// Fetch current hero data
router.get('/hero', async (req, res) => {
  try {
    const hero = await Hero.findOne({}); // Fetch the hero data
    res.status(200).json(hero); // Respond with hero data
  } catch (error) {
    console.error('Error fetching hero data:', error);
    res.status(500).json({ message: 'Failed to fetch hero data.', error });
  }
});



export default router;


