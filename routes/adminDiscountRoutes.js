import express from "express";
import { getDiscount, createDiscount, updateDiscount, deleteDiscount } from "../controllers/adminDiscountController.js";

const router = express.Router();

// ✅ Route to get the latest discount
router.get("/", getDiscount);

// ✅ Route to create a new discount
router.post("/", createDiscount);

// ✅ Route to update an existing discount
router.put("/:id", updateDiscount);

// ✅ Route to delete a discount
router.delete("/:id", deleteDiscount);

export default router;
