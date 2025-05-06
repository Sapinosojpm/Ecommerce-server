// routes/liveSellingRoutes.js
import express from 'express';
import { startLiveSelling, stopLiveSelling, getLiveSellingStatus } from '../controllers/liveSellingController.js';
import authUser from '../middleware/adminAuth.js';

const router = express.Router();

router.post('/start', authUser, startLiveSelling);
router.post('/stop', authUser, stopLiveSelling);
router.get('/status', getLiveSellingStatus);

export default router;
