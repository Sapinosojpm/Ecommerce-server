import Chat from '../models/liveChatModel.js';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import { io } from '../server.js';

// Start a new conversation with admin
export const initiateChat = async (req, res) => {
  try {
    const user = req.user;
    const { initialMessage, orderId, productId } = req.body;

    // Find an available admin
    const admin = await User.findOne({ role: 'admin' });

    if (!admin) {
      return res.status(404).json({ 
        message: 'No admin available at the moment. Please try again later.' 
      });
    }

    const newChat = new Chat({
      sender: user._id || user.id,
      recipient: admin._id,
      message: initialMessage,
      isAdminMessage: false,
      orderReference: orderId,
      productReference: productId
    });

    await newChat.save();

    // Notify admin via Socket.IO
    io.to(admin._id.toString()).emit('new-chat-request', {
      userId: user._id,
      userName: `${user.firstName} ${user.lastName}`,
      initialMessage,
      orderId,
      productId
    });

    res.status(201).json(newChat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin sends message to user
export const adminReply = async (req, res) => {
  try {
    const admin = req.user;
    const { userId, message, chatId } = req.body;

    if (admin.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can use this endpoint' });
    }

    const newMessage = new Chat({
      sender: admin.id,
      recipient: userId,
      message,
      isAdminMessage: true
    });

    await newMessage.save();

    // Send to user via Socket.IO
    io.to(userId).emit('admin-message', newMessage);

    // Update read status if this is a reply to an existing chat
    if (chatId) {
      await Chat.findByIdAndUpdate(chatId, { read: true });
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get conversation between user and admin
export const getAdminUserConversation = async (req, res) => {
  try {
    const user = req.user;
    const { adminId } = req.params;

    const messages = await Chat.find({
      $or: [
        { sender: user._id, recipient: adminId },
        { sender: adminId, recipient: user._id }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'firstName lastName avatar')
    .populate('orderReference', 'orderNumber')
    .populate('productReference', 'name mainImage');

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all active chats for admin
export const getActiveChats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can access this endpoint' });
    }

    const activeChats = await Chat.aggregate([
      {
        $match: {
          recipient: req.user._id,
          read: false
        }
      },
      {
        $group: {
          _id: '$sender',
          lastMessage: { $last: '$$ROOT' },
          unreadCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userId: '$_id',
          userName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          userAvatar: '$user.avatar',
          lastMessage: 1,
          unreadCount: 1,
          lastActivity: '$lastMessage.createdAt'
        }
      },
      {
        $sort: { lastActivity: -1 }
      }
    ]);

    res.status(200).json(activeChats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark messages as read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { senderId } = req.params;
    const recipientId = req.user._id;

    await Chat.updateMany(
      { 
        sender: senderId, 
        recipient: recipientId,
        read: false 
      },
      { $set: { read: true } }
    );

    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload attachment
export const uploadAttachment = async (req, res) => {
  try {
    const { recipientId } = req.params;
    const senderId = req.user._id;
    const { file } = req;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const newMessage = new Chat({
      sender: senderId,
      recipient: recipientId,
      message: 'Attachment',
      isAdminMessage: req.user.role === 'admin',
      attachments: [{
        url: `/uploads/${file.filename}`,
        type: file.mimetype.split('/')[0] // 'image', 'video', etc.
      }]
    });

    await newMessage.save();

    // Emit via Socket.IO
    if (req.user.role === 'admin') {
      io.to(recipientId).emit('admin-message', newMessage);
    } else {
      io.to('admin-room').emit('user-message', newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};