import express from 'express';
import { getHero, updateHero } from '../controllers/heroController.js';
import { protect, admin } from '../middleware/adminAuth.js';

const router = express.Router();

router.get('/hero', getHero);
router.put(
  '/hero',
  protect,
  admin,
  updateHero
);

export default router;