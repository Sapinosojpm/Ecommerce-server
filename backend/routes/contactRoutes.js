import express from 'express';
import { getContactData, updateContactData } from '../controllers/contactController.js';
import { upload } from '../config/uploadConfig.js';  // Import the upload configuration

const router = express.Router();

// Route to fetch contact data
router.get('/contact', getContactData);

// Route to update contact data, including image upload
// Make sure 'upload.single('image')' is placed before the controller function
router.put('/contact', upload.single('image'), updateContactData);

export default router;
