import express from 'express';
import {
  getLiveStreamStatus,
  toggleStreamStatus,
  postComment
} from '../controllers/liveStreamController.js';

const router = express.Router();

router.get('/status', getLiveStreamStatus);
router.post('/toggle', toggleStreamStatus);
router.post('/comment', postComment);

export default router;
