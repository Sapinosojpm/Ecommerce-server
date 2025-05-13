import express from 'express';
import { 
  addReview, 
  getReviewsByProduct, 
  deleteReview,
  canReviewProduct
} from '../controllers/ProductReview.js';
import userAuth from '../middleware/adminAuth.js';

const router = express.Router();

router.post('/add', userAuth, addReview);
router.get('/:productId', getReviewsByProduct);
router.delete('/:reviewId', userAuth, deleteReview);
router.get('/can-review/:productId/:userId', userAuth, canReviewProduct);

export default router;