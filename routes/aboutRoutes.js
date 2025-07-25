// routes/aboutRoutes.js
import express from 'express';
import { 
  getAboutData, 
  updateAboutData, 
  deleteAboutImage 
} from '../controllers/aboutController.js';

const router = express.Router();

// Route to fetch About data
router.get('/about', getAboutData);

// Route to update About data, including image upload
router.put('/about', updateAboutData);

// Route to delete About image
router.delete('/about/image', deleteAboutImage);

export default router;