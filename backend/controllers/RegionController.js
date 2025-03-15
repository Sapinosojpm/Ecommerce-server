import Region from "../models/Region.js"; // Assuming a Region model exists

// Get all regions
export const getRegions = async (req, res) => {
  try {
    const regions = await Region.find();
    res.json(regions);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve regions." });
  }
};

// Add a new region
export const addRegion = async (req, res) => {
  try {
    const { name, fee } = req.body; // Include fee in the request body
    const newRegion = new Region({ name, fee }); // Save the fee along with the name
    await newRegion.save();
    res.status(201).json(newRegion);
  } catch (error) {
    res.status(500).json({ message: "Failed to add region." });
  }
};

// Update an existing region
export const updateRegion = async (req, res) => {
  const { id } = req.params;
  const { name, fee } = req.body; // Include fee in the request body

  try {
    const updatedRegion = await Region.findByIdAndUpdate(
      id,
      { name, fee }, // Update both name and fee
      { new: true }
    );
    if (!updatedRegion) {
      return res.status(404).json({ message: "Region not found." });
    }
    res.json(updatedRegion);
  } catch (error) {
    res.status(500).json({ message: "Failed to update region." });
  }
};

// Delete a region
export const deleteRegion = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedRegion = await Region.findByIdAndDelete(id);
    if (!deletedRegion) {
      return res.status(404).json({ message: "Region not found." });
    }
    res.json({ message: "Region deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete region." });
  }
};
