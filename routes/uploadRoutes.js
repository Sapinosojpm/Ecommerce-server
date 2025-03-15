import express from 'express';
import multer from 'multer';
import cloudinary from 'cloudinary';
import { v2 as cloudinaryV2 } from 'cloudinary'; // Import Cloudinary v2

const router = express.Router();

// Set up multer for file storage (local storage is not needed here)
const storage = multer.memoryStorage(); // Store image in memory
const upload = multer({ storage });

// Example upload route
router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  // Upload image to Cloudinary
  cloudinaryV2.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
    if (error) {
      return res.status(500).json({ success: false, message: 'Error uploading to Cloudinary', error });
    }

    // Return the image URL
    return res.json({ success: true, imageUrl: result.secure_url });
  }).end(req.file.buffer); // Use the file buffer for Cloudinary upload
});

export default router;
