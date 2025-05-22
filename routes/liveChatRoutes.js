import express from 'express';
import {
  initiateChat,
  adminReply,
  getAdminUserConversation,
  getActiveChats,
  markMessagesAsRead,
  uploadAttachment
} from '../controllers/liveChatController.js';

import { protect, admin} from '../middleware/adminAuth.js'; // Middleware to check user and admin
import upload from '../middleware/multer.js'; // File upload config
import authUser from '../middleware/adminAuth.js';
const router = express.Router();

// 📦 User initiates chat with admin
router.post('/initiate', protect, initiateChat);

// 👀 User fetches conversation with a specific admin
router.get('/conversation/:adminId', protect, getAdminUserConversation);

// ✅ Mark messages as read by senderId
router.put('/read/:senderId', protect, markMessagesAsRead);

// 🧑‍💼 Admin replies to a chat
router.post('/admin/reply', protect,authUser, admin, adminReply);

// 📊 Admin gets all active chats
router.get('/admin/active-chats', protect, admin, getActiveChats);

// 📁 Upload attachment (image, file, etc.)
router.post(
  '/upload/:recipientId',
  protect,
  upload.single('file'), // Accept a single file with field name 'file'
  uploadAttachment
);

export default router;
