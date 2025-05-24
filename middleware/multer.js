// middleware/uploadCloudinary.js
import multer from 'multer';
import storage from '../config/cloudinaryStorage.js'; // Assuming you have a cloudinary storage setup

const upload = multer({ storage });

export default upload;
