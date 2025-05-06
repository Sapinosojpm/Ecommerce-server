// routes/productReviewRoutes.js
import express from 'express';
import { addReview, getReviewsByProduct, deleteReview } from '../controllers/ProductReview.js';

const router = express.Router();

router.post('/add', addReview); // Add a review
router.get('/:productId', getReviewsByProduct); // Get reviews for a product
router.delete('/:reviewId', deleteReview); // Delete a review

export default router;