// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';

export function connectCloudinary() {
  if (!process.env.CLOUDINARY_NAME || 
      !process.env.CLOUDINARY_API_KEY || 
      !process.env.CLOUDINARY_SECRET_KEY) {
    throw new Error('Missing Cloudinary configuration in environment variables');
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
  });

  console.log('Cloudinary configured successfully');
  return cloudinary;
}

// Export both the function and configured instance
export default connectCloudinary();