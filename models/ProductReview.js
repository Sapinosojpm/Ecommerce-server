import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: { // Ensure this is named `comment`, not `review`
    type: String,
    required: true,
  },
  name: { // Add this if your database expects `name`
    type: String,
    required: false, 
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

const Review = mongoose.models.ProductReview || mongoose.model("ProductReview", reviewSchema);

export default Review;
