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

    // Create a unique cart key based on item ID and selected variations
    const variationKey = Object.entries(selectedVariations)
      .map(([k, v]) => `${k}:${v.name}`)
      .join('|');
    const cartKey = variationKey ? `${itemId}-${variationKey}` : itemId;

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

    console.log("🟡 Received updateCart request:", req.body);

    const userData = await userModel.findById(userId);
    if (!userData) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let cartData = userData.cartData || {}; // Ensure cartData exists

    // If cartData is an array, reset it to an empty object
    if (Array.isArray(cartData)) {
      console.log("⚠️ cartData is an array! Resetting it to an object...");
      cartData = {};
    }

    console.log("🟢 Existing cart data before update:", cartData);

    if (quantity > 0) {
      // Preserve variations if they exist when updating quantity
      if (cartData[itemId]) {
        cartData[itemId] = {
          quantity,
          variations: cartData[itemId].variations || null,
        };
      } else {
        // If item doesn't exist, add it with default quantity and no variations
        cartData[itemId] = {
          quantity,
          variations: null,
        };
      }
    } else {
      // Remove item if quantity is 0
      delete cartData[itemId];
    }

    // Update the cartData in the database
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
    const token = req.headers.token;
    if (!token) {
      return res.status(401).json({ success: false, message: "Token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Replace with your actual secret
    const userId = decoded.id;

    const userData = await userModel.findById(userId);
    if (!userData) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let cartData = userData.cartData || {};
    if (Array.isArray(cartData)) cartData = {}; // Prevent legacy format issues

    res.json({ success: true, cartData });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
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

export { addToCart, updateCart, getUserCart, clearCart };
