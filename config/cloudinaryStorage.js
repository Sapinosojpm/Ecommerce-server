// config/cloudinaryStorage.js
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinary.js';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'hero_uploads', // optional folder name in Cloudinary
      resource_type: file.mimetype.startsWith('video') ? 'video' : 'image',
      public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`,
    };
  },
});


export default storage;
