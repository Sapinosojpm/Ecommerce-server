import express from 'express';
import { getAboutData, updateAboutData } from '../controllers/aboutController.js';
import { upload } from '../config/uploadConfig.js';  // Import from the correct config file

const router = express.Router();

// Route to fetch About data
router.get('/about', getAboutData);

// Route to update About data, including image upload
router.put('/about', upload.single('image'), updateAboutData); // 'image' should match the form field name

export default router;
