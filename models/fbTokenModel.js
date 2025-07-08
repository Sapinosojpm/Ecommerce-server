import mongoose from 'mongoose';

const fbTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  fbAccessToken: { type: String, required: true },
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 } // 7 days expiry
});

const FbToken = mongoose.model('FbToken', fbTokenSchema);
export default FbToken; 