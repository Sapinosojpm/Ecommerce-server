// controllers/ProductReview.js
import Review from "../models/ProductReview.js";
import User from "../models/userModel.js"; // Adjust path if necessary
import Product from "../models/productModel.js"; // Adjust path if necessary
// Add a review
// controllers/ProductReview.js
export const addReview = async (req, res) => {
    const { productId, userId, rating, comment } = req.body;
  
    console.log("Received review data:", { productId, userId, rating, comment }); 
  
    if (!productId || !userId || !rating || !comment) {
      return res.status(400).json({ message: "Missing required fields" });
    }
  
    try {
      // Fetch user to get name if required
      const user = await User.findById(userId);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
  
      const newReview = new Review({
        productId,
        userId,
        rating,
        comment, 
        review: comment || "",
        name: user.firstName || "Anonymous",  // Add this only if required
      });
  
      await newReview.save();
      const product = await Product.findById(productId);
        if (product) {
      await product.updateRatingStats();
    }

    console.log("Review saved successfully:", newReview); 
    res.status(201).json({ message: "Review added successfully!", review: newReview });
  
    } catch (error) {
      console.error("Error adding review:", error);
      res.status(500).json({ message: "Error adding review", error: error.message });
    }
  };
  
// Get reviews for a product
export const getReviewsByProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    const reviews = await Review.find({ productId }).populate("userId", "username"); // Populate user details
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Error fetching reviews", error: error.message });
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  const { reviewId } = req.params;

  try {
    const review = await Review.findByIdAndDelete(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting review", error: error.message });
  }
};