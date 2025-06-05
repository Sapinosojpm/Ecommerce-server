import express from "express";
import upload from "../middleware/multer.js"; // Changed to use Cloudinary upload
import Logo from "../models/logoModel.js";

const router = express.Router();

// Upload or update the logo using Cloudinary
router.post("/upload", upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path; // Cloudinary provides the URL in req.file.path

    let logo = await Logo.findOne();
    if (!logo) {
      logo = new Logo({ imageUrl: filePath });
    } else {
      logo.imageUrl = filePath;
    }
    await logo.save();

    res.json({ 
      message: "Logo updated successfully!", 
      imageUrl: filePath 
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