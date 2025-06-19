import express from 'express';
import { 
  addTracking, 
  getTrackingInfo, 
  webhookHandler, 
  getCarriers,
  detectCarrier,
  syncAllOrderStatuses
} from '../controllers/trackingController.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';

const router = express.Router();

// Admin routes
router.post('/order/:orderId/tracking', adminAuth, addTracking);
router.get('/carriers', adminAuth, getCarriers);
router.post('/detect-carrier', adminAuth, detectCarrier);
router.post('/sync-statuses', adminAuth, syncAllOrderStatuses);

// User routes
router.get('/order/:orderId/status', authUser, getTrackingInfo);

// Webhook
router.post('/webhook', webhookHandler);

export default router;