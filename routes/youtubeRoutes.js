import express from "express";
import multer from "multer";
import path from "path";
import {
  getYoutubeUrlController,
  updateYoutubeUrlController,
  uploadLocalVideoController
} from "../controllers/youtubeController.js";

const router = express.Router();

// Multer storage setup for local video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/videos"); // Save videos in "uploads/videos" folder
  },
  filename: (req, file, cb) => {
    cb(null, `video_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

// Route to fetch the current video URL (YouTube or local)
router.get("/", getYoutubeUrlController);

// Route to update the YouTube URL
router.post("/", updateYoutubeUrlController);

// Route to upload a local video
router.post("/upload-video", upload.single("video"), uploadLocalVideoController);

export default router;
