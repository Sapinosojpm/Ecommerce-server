import express from 'express';
import { sendEmail } from '../controllers/chatController.js'; // Import the sendEmail controller
import authUser from '../middleware/auth.js';

const router = express.Router();

// POST route to send the chat message and email
router.post('/send-email',authUser, sendEmail);

export default router;
