import express from "express";
import Logo from "../models/logoModel.js";

const router = express.Router();

// TODO: Handle S3 URL for logo
// Remove multer middleware from logo upload route
router.post("/upload", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: "No image URL provided" });
    }
    let logo = await Logo.findOne();
    if (!logo) {
      logo = new Logo({ imageUrl });
    } else {
      logo.imageUrl = imageUrl;
    }
    await logo.save();
    res.json({ 
      message: "Logo updated successfully!", 
      imageUrl: logo.imageUrl 
    });
  } catch (error) {
    console.error("Error uploading logo:", error);
    res.status(500).json({ error: "Failed to upload logo" });
  }
});

// Get the current logo
router.get("/", async (req, res) => {
  try {
    const logo = await Logo.findOne();
    res.json({ 
      imageUrl: logo ? logo.imageUrl : "/default-logo.png" 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch logo" });
  }
});

export default router;