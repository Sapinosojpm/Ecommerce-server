import mongoose from 'mongoose';

const heroSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    image: { type: String },
    video: { type: String },
  },
  {
    timestamps: true,
  }
);

const Hero = mongoose.model('Hero', heroSchema);
export default Hero;
