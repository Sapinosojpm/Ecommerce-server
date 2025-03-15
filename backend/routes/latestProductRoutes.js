import express from "express";
import { getLatestProductSetting, updateLatestProductSetting } from "../controllers/latestProductController.js";

const router = express.Router();

router.get("/", getLatestProductSetting);
router.put("/", updateLatestProductSetting);

export default router;
