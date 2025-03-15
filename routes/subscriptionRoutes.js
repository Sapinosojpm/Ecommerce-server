import express from 'express';
import { subscribe } from '../controllers/subscriptionController.js'; // Import the subscribe controller

const router = express.Router();

// Subscription route: POST /api/subscribe
router.post('/subscribe', subscribe);

export default router;
