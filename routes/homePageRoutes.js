import express from 'express';
import { getHomePageSettings, updateHomePageSettings } from '../controllers/homePageController.js';

const router = express.Router();

router.get('/', getHomePageSettings);
router.put('/', updateHomePageSettings);

export default router;
