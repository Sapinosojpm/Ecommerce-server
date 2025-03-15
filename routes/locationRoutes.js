import express from "express";
import { getLocation, updateLocation } from "../controllers/locationController.js";

const router = express.Router();

router.get("/", getLocation);
router.put("/", updateLocation);

export default router;
