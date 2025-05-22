import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isAdminMessage: {
    type: Boolean,
    default: false
  },
  orderReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  productReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  },
  attachments: [{
    url: String,
    type: String // 'image', 'document', etc.
  }]
}, {
  timestamps: true
});

// Indexes for faster queries
chatSchema.index({ sender: 1, recipient: 1 });
chatSchema.index({ createdAt: -1 });

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;