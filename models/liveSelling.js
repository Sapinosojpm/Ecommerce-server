// models/LiveSelling.js
import mongoose from 'mongoose';

const liveSellingSchema = new mongoose.Schema({
  isActive: { type: Boolean, default: false },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startTime: { type: Date, default: Date.now },
});

const LiveSelling = mongoose.model('LiveSelling', liveSellingSchema);

export default LiveSelling;
