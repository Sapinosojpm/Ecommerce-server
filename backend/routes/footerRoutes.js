// routes/footerRoutes.js

import express from 'express';
import { getFooterData, updateFooterData } from '../controllers/footerController.js';

const router = express.Router();

// Get Footer Data
router.get('/footer', getFooterData);

// Update Footer Data
router.put('/footer', updateFooterData);

export default router;
