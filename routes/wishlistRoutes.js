import express from "express";
import { addToWishlist, removeFromWishlist, getWishlist, clearWishlist } from "../controllers/wishlistController.js";

const router = express.Router();

router.get("/", getWishlist);  // This fetches the wishlist
router.post("/add", addToWishlist); // Add to wishlist
router.delete("/", removeFromWishlist); // DELETE method for removing from wishlist
router.delete("/clear/:userId", clearWishlist); // Clear entire wishlist for a user

export default router;
