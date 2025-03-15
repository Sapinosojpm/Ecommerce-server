// routes/authRoutes.js
import express from "express";
import { googleAuth } from "../controllers/authController.js";
const router = express.Router();

// Google OAuth route
router.post("/google", googleAuth);

export default router;
