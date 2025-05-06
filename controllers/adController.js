import { AdModel } from "../models/AdModel.js";

// Get all ads
export const getAds = async (req, res) => {
  try {
    const ads = await AdModel.find();
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Add new ad
export const addAd = async (req, res) => {
  try {
    const { imageUrl, link, isActive } = req.body;
    const newAd = new AdModel({ imageUrl, link, isActive });
    await newAd.save();
    res.status(201).json(newAd);
  } catch (error) {
    res.status(400).json({ error: "Failed to add ad" });
  }
};

// Update ad
export const updateAd = async (req, res) => {
  try {
    const updatedAd = await AdModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedAd);
  } catch (error) {
    res.status(400).json({ error: "Failed to update ad" });
  }
};

// Delete ad
export const deleteAd = async (req, res) => {
  try {
    await AdModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Ad deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: "Failed to delete ad" });
  }
};
