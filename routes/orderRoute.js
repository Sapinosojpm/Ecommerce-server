import express from 'express';
import { 
  placeOrder, 
  placeOrderStripe, 
  allOrders, 
  userOrders, 
  updateStatus, 
  verifyStripe, 
  cancelOrder,
  uploadReceipt,
  getReceipt, 
  confirmPayment,
  getOrderForPayment,
  processPayment,
  verifyPayment,
  scanQrAndUpdateStatus,
  createStripeCheckoutSession,
  verifyStripePayment,
} from '../controllers/orderController.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import {upload} from '../config/uploadConfig.js';

const orderRouter = express.Router();

// Admin Features
orderRouter.post('/list', adminAuth, allOrders);
orderRouter.post('/status', adminAuth, updateStatus);

// Payment Features
orderRouter.post('/place', authUser, placeOrder);
orderRouter.post('/stripe', authUser, placeOrderStripe);
orderRouter.post('/upload-receipt', authUser, uploadReceipt);

// User Features
orderRouter.post('/userorders', authUser, userOrders);
orderRouter.put('/cancel/:id', authUser, cancelOrder);
orderRouter.delete('/cancel/:id', authUser, cancelOrder);

// Verify Payment
orderRouter.post('/verifyStripe', authUser, verifyStripe);
orderRouter.get("/receipt/:orderId", getReceipt);
orderRouter.post("/confirm-payment", confirmPayment);

// Pay Now routes
orderRouter.get('/:id/payment', authUser, getOrderForPayment);
orderRouter.post('/:id/pay', authUser, processPayment);
orderRouter.post('/:id/verify-payment', authUser, verifyPayment);
// Add to orderRoute.js
orderRouter.post('/scan-qr', adminAuth, scanQrAndUpdateStatus);
orderRouter.post('/:orderId/stripe-checkout', authUser, (req, res, next) => {
  console.log('Stripe checkout route called', req.params.orderId, req.userId);
  next();
}, createStripeCheckoutSession);
orderRouter.post('/verify-stripe', authUser, verifyStripePayment);
export default orderRouter;