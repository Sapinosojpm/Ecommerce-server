import express from "express";
import { getBestSellerSetting, updateBestSellerSetting } from "../controllers/bestSellerController.js";

const router = express.Router();

router.get("/", getBestSellerSetting);
router.put("/", updateBestSellerSetting);

export default router;
