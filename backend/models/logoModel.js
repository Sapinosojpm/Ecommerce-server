import mongoose from "mongoose";

const logoSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
});

const Logo = mongoose.model("Logo", logoSchema);
export default Logo;
