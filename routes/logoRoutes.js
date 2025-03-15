import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Logo from "../models/logoModel.js";

const router = express.Router();

// Set storage engine for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/logos";
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, "logo" + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Upload or update the logo
router.post("/upload", upload.single("logo"), async (req, res) => {
  try {
    const filePath = `/uploads/logos/${req.file.filename}`;

    let logo = await Logo.findOne();
    if (!logo) {
      logo = new Logo({ imageUrl: filePath });
    } else {
      logo.imageUrl = filePath;
    }
    await logo.save();

    res.json({ message: "Logo updated successfully!", imageUrl: filePath });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload logo" });
  }
});

// Get the current logo
router.get("/", async (req, res) => {
  try {
    const logo = await Logo.findOne();
    res.json({ imageUrl: logo ? logo.imageUrl : "/default-logo.png" });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch logo" });
  }
});

export default router;
