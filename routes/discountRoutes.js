import express from 'express';
import { validateDiscount, addDiscount } from '../controllers/discountController.js';
import authUser from '../middleware/auth.js';

const router = express.Router();

router.post('/validate', authUser, validateDiscount); // Validate discount code
router.post('/add', authUser, addDiscount); // Add new discount code (admin only)

export default router;
