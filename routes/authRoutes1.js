import express from "express";
import { googleAuth } from "../controllers/authController1.js";

const router = express.Router();

router.post("/google-signup", googleAuth); // ✅ Matches frontend API call

export default router;
