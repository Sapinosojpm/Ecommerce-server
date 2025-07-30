import express from "express";
import {
  placeOrderPaymongo,
  verifyPayment,
  retryPaymongoPayment
} from "../controllers/PaymentController.js";
import authUser from "../middleware/auth.js";

const router = express.Router();
router.get("/api/payment/verify", (req, res, next) => {
  console.log('[Route Hit] /api/payment/verify was hit!');
  next(); // Proceed to the next middleware/controller
});
router.post("/api/payment/paymongo", authUser, placeOrderPaymongo);
router.get("/api/payment/verify", verifyPayment);
router.post("/api/payment/paymongo/retry", authUser, retryPaymongoPayment);
export default router;