import express from "express";
import { getRegions, addRegion, updateRegion, deleteRegion } from "../controllers/RegionController.js";

const router = express.Router();

// Get all regions
router.get("/", getRegions);

// Add a new region
router.post("/", addRegion);

// Update an existing region
router.put("/:id", updateRegion);

// Delete a region
router.delete("/:id", deleteRegion);

export default router;
