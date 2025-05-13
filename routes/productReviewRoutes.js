import express from 'express';
import { 
  addReview, 
  getReviewsByProduct, 
  deleteReview,
  canReviewProduct
} from '../controllers/ProductReview.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

router.post('/add', adminAuth, addReview);
router.get('/:productId', getReviewsByProduct);
router.delete('/:reviewId', adminAuth, deleteReview);
router.get('/can-review/:productId/:userId', adminAuth, canReviewProduct);

export default router;