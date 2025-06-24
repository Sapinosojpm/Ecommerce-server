import userModel from "../models/userModel.js";

// add products to user cart
const addToCart = async (req, res) => {
  try {
    const {
      userId,
      itemId,
      quantity,
      variations,
      variationAdjustment,
      finalPrice,
    } = req.body;

    const userData = await userModel.findById(userId);
    if (!userData) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let cartData = userData.cartData || {};

    // Filter only selected variations (if any)
    const selectedVariations = {};
    if (variations && typeof variations === 'object') {
      Object.entries(variations).forEach(([key, value]) => {
        if (value?.name) {
          selectedVariations[key] = {
            name: value.name,
            priceAdjustment: Number(value.priceAdjustment || 0),
          };
        }
      });
    }

    // Use the itemId from the frontend as the cart key
    const cartKey = itemId;

    // Add or update item in cart
    if (cartData[cartKey]) {
      cartData[cartKey].quantity += quantity;
    } else {
      cartData[cartKey] = {
        itemId,
        quantity,
        variations: selectedVariations,
        variationAdjustment,
        finalPrice,
      };
    }

    console.log("🟢 Updated cartData:");
    Object.entries(cartData).forEach(([id, item]) => {
      console.log(`🛒 Item ID: ${id}`);
      console.log(`Quantity: ${item.quantity}`);
      console.log(`Final Price: ₱${item.finalPrice}`);
      if (item.variations) {
        console.log(`   Variations:`);
        Object.entries(item.variations).forEach(([variationKey, variationValue]) => {
          console.log(`     • ${variationKey}: ${variationValue.name} (+₱${variationValue.priceAdjustment})`);
        });
      }
    });

    // Update cart in database
    await userModel.findByIdAndUpdate(
      userId,
      { $set: { cartData } },
      { new: true }
    );

    res.json({ success: true, message: "Item added to cart", cartData });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// update user cart
const updateCart = async (req, res) => {
  try {
    const { userId, itemId, quantity } = req.body;

    if (!userId || !itemId || quantity === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const userData = await userModel.findById(userId);
    if (!userData) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let cartData = userData.cartData || {};

    // Use the itemId from the frontend as the cart key
    const cartItemKey = itemId;

    if (!cartItemKey || !cartData[cartItemKey]) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart"
      });
    }

    if (quantity > 0) {
      // Update the existing item's quantity
      cartData[cartItemKey].quantity = quantity;
    } else {
      // Remove item if quantity is 0 or less
      delete cartData[cartItemKey];
    }

    await userModel.findByIdAndUpdate(
      userId,
      { $set: { cartData } },
      { new: true }
    );

    res.json({ success: true, message: "Cart updated", cartData });
  } catch (error) {
    console.error("❌ Error in updateCart:", error);
    res.status(500).json({ success: false, message: "Failed to update cart." });
  }
};

// get user cart
// In getUserCart controller
const getUserCart = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID is required" 
      });
    }

    const userData = await userModel.findById(userId);
    if (!userData) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Normalize cartData format
    let cartData = {};
    if (userData.cartData) {
      if (Array.isArray(userData.cartData)) {
        // Convert legacy array format to object
        userData.cartData.forEach(item => {
          if (item._id) {
            cartData[item._id] = {
              quantity: item.quantity,
              variations: item.variations || null
            };
          }
        });
      } else {
        cartData = userData.cartData;
      }
    }

    res.json({ 
      success: true, 
      cartData 
    });
  } catch (error) {
    console.error("Error in getUserCart:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// Clear user cart
const clearCart = async (req, res) => {
  try {
    const userId = req.body.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User ID missing" });
    }

    // In clearCart controller
    await userModel.findByIdAndUpdate(userId, { $set: { cartData: {} } });

    res.json({ success: true, message: "Cart cleared successfully" });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ success: false, message: "Failed to clear cart." });
  }
};
// Remove specific item from cart
const removeFromCart = async (req, res) => {
  try {
    const { userId, itemId } = req.body;

    // Debug log to check if userId and itemId are received
    console.log('removeFromCart called with:', { userId, itemId });

    if (!userId || !itemId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Item ID are required"
      });
    }

    const userData = await userModel.findById(userId);
    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    let cartData = userData.cartData || {};
    
    // Debug logs to help diagnose 404 issue
    console.log('itemId from frontend:', itemId);
    console.log('cartData keys:', Object.keys(cartData));

    // Remove only the exact item key
    if (!cartData[itemId]) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart"
      });
    }
    delete cartData[itemId];

    await userModel.findByIdAndUpdate(
      userId,
      { $set: { cartData } },
      { new: true }
    );

    res.json({
      success: true,
      message: "Item removed from cart",
      cartData
    });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove item from cart"
    });
  }
};
export { addToCart, updateCart, getUserCart, clearCart,removeFromCart };
