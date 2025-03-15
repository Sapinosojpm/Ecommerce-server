import mongoose from 'mongoose';

const policySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true }, // Image URL or file path
}, { timestamps: true });

const Policy = mongoose.model('Policy', policySchema);
export default Policy;
