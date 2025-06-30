import express from 'express';
import authUser from '../middleware/auth.js'
import { placeOrderGcash, verifyGCashPayment, payExistingOrderGcash } from '../controllers/PaymentController.js';

const router = express.Router();

// Apply authUser middleware to routes that need authentication
router.post('/api/payment/gcash', authUser, placeOrderGcash);
router.post('/api/payment/gcash/verify', authUser, verifyGCashPayment);
router.get('/api/payment/gcash/verify', verifyGCashPayment); // ✅ Add this route
router.post('/gcash/pay/:orderId', payExistingOrderGcash);
router.get('/gcash/verify', verifyGCashPayment);

export default router;
