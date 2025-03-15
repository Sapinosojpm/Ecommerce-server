import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';

// Get the current directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the upload directory path
const uploadDir = path.join(__dirname, '..', 'uploads');

// Ensure the 'uploads' folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Define the destination folder for uploads
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + '-' + file.originalname;
    cb(null, filename); // Store the file with a timestamp prefix to ensure unique filenames
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'), false); // Reject if not an image
    }
    cb(null, true); // Accept the file
  },
});

export { upload }; // Export the upload middleware for use in other files
