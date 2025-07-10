import express from 'express';
import multer from 'multer';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Set up multer for file storage (local storage is not needed here)
const storage = multer.memoryStorage(); // Store image in memory
const upload = multer({ storage });

// AWS S3 configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Endpoint to get a pre-signed URL for image upload
router.post('/presigned-url', async (req, res) => {
  try {
    const { fileType } = req.body;
    if (!fileType) {
      return res.status(400).json({ success: false, message: 'Missing fileType' });
    }
    const fileExtension = fileType.split('/')[1];
    const fileName = `${uuidv4()}.${fileExtension}`;
    const s3Params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Expires: 60 * 5, // 5 minutes
      ContentType: fileType
    };
    const uploadUrl = await s3.getSignedUrlPromise('putObject', s3Params);
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    res.json({ success: true, uploadUrl, fileUrl });
  } catch (error) {
    console.error('Error generating S3 pre-signed URL:', error);
    res.status(500).json({ success: false, message: 'Failed to generate pre-signed URL', error: error.message });
  }
});

export default router;
