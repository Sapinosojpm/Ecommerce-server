import express from "express";
import {
  placeOrderPaymongo,
  verifyPayment,
} from "../controllers/PaymentController.js";
import authUser from "../middleware/auth.js";

const router = express.Router();

router.post("/api/payment/paymongo", authUser, placeOrderPaymongo);
router.get("/api/payment/verify", verifyPayment);

export default router;