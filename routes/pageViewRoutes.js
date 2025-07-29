import express from "express";
import { trackPageView, getPageViews } from "../controllers/pageViewController.js";
import authUser from "../middleware/auth.js";

const router = express.Router();

router.post("/track", trackPageView); // Allow guests and logged-in users
router.get("/views", authUser, getPageViews);

export default router;
