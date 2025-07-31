import express from "express";
import {
  placeOrderPaymongo,
  verifyPayment,
  retryPaymongoPayment,
  testWebhook,
  handlePaymongoWebhook
} from "../controllers/PaymentController.js";
import authUser from "../middleware/auth.js";

const router = express.Router();

// Place Order (Create payment source)
router.post("/paymongo", authUser, placeOrderPaymongo);

// Verify Payment Status
router.get("/verify", 
  (req, res, next) => {
    console.log('[Route Hit] /api/payment/verify was hit!');
    next(); // Log the route hit (optional)
  },
  verifyPayment
);

// Retry Payment
router.post("/paymongo/retry", authUser, retryPaymongoPayment);

// Test Webhook (Optional: Remove auth for testing purposes)
router.post("/webhook/test", testWebhook);

export { handlePaymongoWebhook };
export default router;
