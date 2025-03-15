import userModel from "../models/userModel.js";
import mongoose from "mongoose"; 
import productModel from "../models/productModel.js"; 

// Get user's wishlist
export const getWishlist = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Populate product details from `productModel`
    const wishlistProducts = await productModel.find({
      _id: { $in: user.wishlist }, // Fetch product details for wishlist items
    });

    res.status(200).json({ wishlist: wishlistProducts });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add product to wishlist
export const addToWishlist = async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ message: "User ID and Product ID are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid User ID or Product ID format" });
    }

    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const productExists = await productModel.findById(productId);
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Convert all wishlist items to ObjectId before comparison
    user.wishlist = user.wishlist.map((id) => new mongoose.Types.ObjectId(id));

    // Fix ObjectId comparison
    const productObjectId = new mongoose.Types.ObjectId(productId);
    if (user.wishlist.some((id) => id.toString() === productObjectId.toString())) {
      return res.status(200).json({ message: "Product already in wishlist" }); // Changed to 200 OK
    }

    // Add the product to the wishlist
    user.wishlist.push(productObjectId);
    await user.save();

    // Fetch updated wishlist with product details
    const updatedWishlist = await productModel.find({ _id: { $in: user.wishlist } });

    res.status(200).json({ message: "Added to wishlist", wishlist: updatedWishlist });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Remove product from wishlist
// removeFromWishlist in controller
export const removeFromWishlist = async (req, res) => {
  const { userId, productId } = req.body;

  try {
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove the product from the wishlist
    user.wishlist = user.wishlist.filter(
      (product) => product.toString() !== productId
    );

    await user.save();

    res.status(200).json({ message: "Item removed from wishlist" });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(500).json({ message: "Failed to remove item from wishlist" });
  }
};

// Clear the wishlist for a specific user
import User from "../models/userModel.js";

export const clearWishlist = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Received request to clear wishlist for user:", userId);

    if (!userId) {
      console.error("User ID is missing in request");
      return res.status(400).json({ message: "User ID is required" });
    }

    // Check if userId is valid
    if (userId.length !== 24) {
      console.error("Invalid User ID format:", userId);
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      console.error("User not found for ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User found:", user);

    user.wishlist = []; // Empty the wishlist array
    await user.save();

    console.log("Wishlist cleared successfully for user:", userId);
    res.json({ message: "Wishlist cleared successfully" });
  } catch (error) {
    console.error("Error clearing wishlist:", error.message);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

