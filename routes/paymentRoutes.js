import express from "express";
import {
  placeOrderPaymongo,
  verifyPayment,
  retryPaymongoPayment
} from "../controllers/PaymentController.js";
import authUser from "../middleware/auth.js";

const router = express.Router();

router.post("/api/payment/paymongo", authUser, placeOrderPaymongo);
router.get("/api/payment/verify", verifyPayment);
router.post("/api/payment/paymongo/retry", authUser, retryPaymongoPayment);
export default router;