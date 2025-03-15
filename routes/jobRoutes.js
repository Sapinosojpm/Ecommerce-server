import express from "express";
import { 
  getJobPosting, 
  createJobPosting, 
  deleteJobPosting, 
  getJobPostingById 
} from "../controllers/jobController.js";
import { 
  applyForJob, 
  getJobApplications 
} from "../controllers/jobApplicationController.js";
import { upload } from "../middleware/upload.js"; // Middleware for file uploads

const router = express.Router();

// Job Postings Routes
router.get("/api/job-posting", getJobPosting);
router.post("/api/job-posting", upload.single("image"), createJobPosting); // Image upload
router.delete("/api/job-posting/:jobId", deleteJobPosting);
router.get("/api/job-posting/:jobId", getJobPostingById);

// Job Applications Routes
router.post("/api/job-applications", upload.single("resume"), applyForJob);
router.get("/api/job-applications/:jobId", getJobApplications);

export default router;
