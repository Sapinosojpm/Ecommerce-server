import express from "express";
import { AIChatController } from "../controllers/AIChatController.js"; // Ensure correct path

const router = express.Router();

// Define the POST route for the /api/chat endpoint
router.post("/chat", AIChatController);

export default router;
