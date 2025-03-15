// models/AIChat.js
import mongoose from 'mongoose';

const aiChatSchema = new mongoose.Schema({
  userMessage: {
    type: String,
    required: true,
    trim: true,
  },
  aiResponse: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const AIChat = mongoose.model('AIChat', aiChatSchema);

export default AIChat;
