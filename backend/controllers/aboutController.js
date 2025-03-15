import About from '../models/aboutModel.js'; // Ensure the model is correctly imported

// Controller to get About data
// Controller to get About data
export const getAboutData = async (req, res) => {
  try {
    // For testing, set this to the correct URL
    const backendUrl = 'http://localhost:4000';

    const aboutData = await About.findOne({});
    if (aboutData && aboutData.image) {
      // Construct full URL for the image
      aboutData.image = `${backendUrl}/uploads/${aboutData.image}`;
    }

    console.log('About data:', aboutData);
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

    // If an image is uploaded, include it in the update
    if (req.file) {
      updateFields.image = req.file.filename; // Save only the filename
    }

    // Update the About document
    const updatedData = await About.findOneAndUpdate(
      {}, // Find the first document
      { $set: updateFields },
      { new: true } // Return the updated document
    );

    res.json(updatedData);
  } catch (error) {
    console.error('Error updating about data:', error);
    res.status(500).json({ message: 'Error updating about data', error });
  }
};
