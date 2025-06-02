import express from 'express';
import { getHero, updateHero } from '../controllers/heroController.js';
import { protect, admin } from '../middleware/adminAuth.js';
import upload from '../middleware/multer.js';

const router = express.Router();

router.get('/hero', getHero);
router.put(
  '/hero',
  protect,
  admin,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  updateHero
);

export default router;