import cloudinary from 'cloudinary';
import { v2 as cloudinaryV2 } from 'cloudinary';
import About from '../models/contactModel.js'; // Ensure the model is correctly imported

// Configure Cloudinary (you should store your credentials in environment variables)
cloudinaryV2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Controller to get Contact data
// Controller to get Contact data
export const getContactData = async (req, res) => {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

    const contactData = await About.findOne({});  // Fetch the first document
    if (contactData && contactData.image) {
      // If image exists, it's already the Cloudinary URL (thanks to the update logic)
      contactData.image = contactData.image;
    }

    res.json(contactData);  // Returning the contact data including the Cloudinary image URL
  } catch (error) {
    console.error('Error fetching contact data:', error);
    res.status(500).json({ message: 'Error fetching contact data', error });
  }
};


// Controller to update Contact data
export const updateContactData = async (req, res) => {
  try {
    console.log('Received data:', req.body); // Log incoming data
    const updateFields = req.body;

    // If a file is uploaded, upload it to Cloudinary
    if (req.file) {
      console.log('Received file:', req.file); // Log file data

      // Upload the file to Cloudinary and get the URL
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'contact_images', // Optional: Define a folder name in Cloudinary
      });

      // Store the Cloudinary URL in the image field
      updateFields.image = result.secure_url;
    }

    // Find the document to update
    let updatedData = await About.findOneAndUpdate(
      {},
      { $set: updateFields },
      { new: true }
    );

    // If no data exists, create a new document
    if (!updatedData) {
      updatedData = new About(updateFields);
      await updatedData.save();
    }

    res.json(updatedData);  // Send back the updated data
  } catch (error) {
    console.error('Error updating contact data:', error);
    res.status(500).json({ message: 'Error updating contact data', error });
  }
};

