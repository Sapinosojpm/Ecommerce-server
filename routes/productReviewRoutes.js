import express from 'express';
import { 
  addReview, 
  getReviewsByProduct, 
  deleteReview,
  canReviewProduct
} from '../controllers/ProductReview.js';
import authUser from '../middleware/auth.js';

const router = express.Router();

// Correct order: static and specific routes first
router.post('/add', authUser, addReview);
router.get('/can-review/:productId/:userId', authUser, canReviewProduct);
router.delete('/:reviewId', authUser, deleteReview);
router.get('/:productId', getReviewsByProduct); // dynamic route LAST

export default router;
