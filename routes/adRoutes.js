import express from "express";
import { getAds, addAd, updateAd, deleteAd } from "../controllers/adController.js";

const router = express.Router();

router.get("/", getAds);
router.post("/", addAd);
router.put("/:id", updateAd);
router.delete("/:id", deleteAd);

export default router;
