// controllers/ProductReview.js
import Review from "../models/ProductReview.js";
import User from "../models/userModel.js";
import Product from "../models/productModel.js";
import Order from "../models/orderModel.js"; // Import Order model

// Add a review with purchase verification
export const addReview = async (req, res) => {
  const { productId, userId, rating, comment } = req.body;

  if (!productId || !userId || !rating || !comment) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Verify user has purchased and received this product
    const hasPurchased = await Order.exists({
      userId,
      "items.productId": productId,
      status: "Delivered"
    });

    if (!hasPurchased) {
      return res.status(403).json({ 
        message: "You can only review products you've purchased and received" 
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
      return res.status(400).json({ 
        message: "You've already reviewed this product" 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const newReview = new Review({
      productId,
      userId,
      rating,
      comment,
      name: user.firstName || "Anonymous",
    });

    await newReview.save();
    
    // Update product rating stats
    const product = await Product.findById(productId);
    if (product) {
      await product.updateRatingStats();
    }

    res.status(201).json({ 
      message: "Review added successfully!", 
      review: newReview 
    });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ 
      message: "Error adding review", 
      error: error.message 
    });
  }
};

// Get reviews for a product
export const getReviewsByProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    const reviews = await Review.find({ productId })
      .populate("userId", "firstName lastName")
      .sort({ date: -1 }); // Newest first
      
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ 
      message: "Error fetching reviews", 
      error: error.message 
    });
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  const { reviewId } = req.params;
  const { userId } = req.body; // Require user ID for authorization

  try {
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Only allow review owner or admin to delete
    if (review.userId.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({ 
        message: "Not authorized to delete this review" 
      });
    }

    await Review.findByIdAndDelete(reviewId);
    
    // Update product rating stats
    const product = await Product.findById(review.productId);
    if (product) {
      await product.updateRatingStats();
    }

    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ 
      message: "Error deleting review", 
      error: error.message 
    });
  }
};

// Check if user can review a product
export const canReviewProduct = async (req, res) => {
  const { productId, userId } = req.params;

  try {
    const hasPurchased = await Order.exists({
      userId,
      "items.productId": productId,
      status: "Delivered"
    });

    const hasReviewed = await Review.exists({ productId, userId });

    res.status(200).json({
      canReview: hasPurchased && !hasReviewed,
      hasPurchased,
      hasReviewed
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Error checking review eligibility",
      error: error.message 
    });
  }
};