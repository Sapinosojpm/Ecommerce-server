import express from "express";
import { googleAuth } from "../controllers/googleAuthController.js";

const router = express.Router();

// Google authentication routes
router.post("/google-auth", googleAuth);
router.post("/google-signup", googleAuth);

export default router; 