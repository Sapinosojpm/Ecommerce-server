// controllers/aboutController.js
import About from '../models/aboutModel.js';
import { v2 as cloudinary } from 'cloudinary';


// Controller to get About data
export const getAboutData = async (req, res) => {
  try {
    const aboutData = await About.findOne({});
    res.json(aboutData);
  } catch (error) {
    console.error('Error fetching about data:', error);
    res.status(500).json({ message: 'Error fetching about data', error });
  }
};

// Controller to update About data
export const updateAboutData = async (req, res) => {
  try {
    const updateFields = req.body;

    // Get existing data to handle image deletion if new image is uploaded
    const existingData = await About.findOne({});

    // If a new image is uploaded
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (existingData && existingData.image) {
        try {
          // Extract public_id from the Cloudinary URL
          const urlParts = existingData.image.split('/');
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = `about-images/${publicIdWithExtension.split('.')[0]}`;
          
          await cloudinary.uploader.destroy(publicId);
        } catch (deleteError) {
          console.error('Error deleting old image:', deleteError);
        }
      }

      // Set the new image URL from Cloudinary
      updateFields.image = req.file.path; // Cloudinary returns the full URL in req.file.path
    }

    // Update or create the About document
    const updatedData = await About.findOneAndUpdate(
      {}, // Find the first document
      { $set: updateFields },
      { 
        new: true, // Return the updated document
        upsert: true // Create if doesn't exist
      }
    );

    res.json(updatedData);
  } catch (error) {
    console.error('Error updating about data:', error);
    res.status(500).json({ 
      message: 'Error updating about data', 
      error: error.message 
    });
  }
};

// Controller to delete image
export const deleteAboutImage = async (req, res) => {
  try {
    const aboutData = await About.findOne({});
    
    if (aboutData && aboutData.image) {
      // Extract public_id from the Cloudinary URL
      const urlParts = aboutData.image.split('/');
      const publicIdWithExtension = urlParts[urlParts.length - 1];
      const publicId = `about-images/${publicIdWithExtension.split('.')[0]}`;
      
      // Delete from Cloudinary
      await cloudinary.uploader.destroy(publicId);
      
      // Remove image from database
      await About.findOneAndUpdate(
        {},
        { $unset: { image: 1 } },
        { new: true }
      );
      
      res.json({ message: 'Image deleted successfully' });
    } else {
      res.status(404).json({ message: 'No image found to delete' });
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ 
      message: 'Error deleting image', 
      error: error.message 
    });
  }
};