import express from "express";
import { createFAQ, getFAQs, updateFAQ, deleteFAQ } from "../controllers/faqController.js";

const router = express.Router();

// Route to get all FAQs
router.get("/", getFAQs);

// Route to create a new FAQ
router.post("/", createFAQ);

// Route to update an existing FAQ
router.put("/:id", updateFAQ);

// Route to delete an FAQ
router.delete("/:id", deleteFAQ);

export default router;
