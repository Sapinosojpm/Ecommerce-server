import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  name: String,
  comment: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const liveStreamSchema = new mongoose.Schema({
  isLive: {
    type: Boolean,
    default: false,
  },
  viewers: {
    type: Number,
    default: 0,
  },
  comments: [commentSchema],
});

const LiveStream = mongoose.model('LiveStream', liveStreamSchema);

export default LiveStream;
