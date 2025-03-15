import express from "express";
import { getFeePerKilo, updateFeePerKilo } from "../controllers/WeightFeeController.js";

const router = express.Router();

router.get("/fee-per-kilo", getFeePerKilo);
router.put("/fee-per-kilo", updateFeePerKilo);

export default router;
