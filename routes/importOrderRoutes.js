import express from "express";
import { importOrders } from "../controllers/orderImportController.js";

const router = express.Router();

router.post("/import", importOrders);

export default router;
