import express from "express";
import { getReviews, addReview } from "../controllers/reviewController.js";

const router = express.Router();

// Route to get all website reviews
router.get("/reviews", getReviews);

// Route to add a new website review
router.post("/reviews", addReview);

export default router;
