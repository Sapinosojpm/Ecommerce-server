import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import Stripe from "stripe";
import Paymongo from 'paymongo-node';
import axios from 'axios';
import Subscriber from "../models/subscriber.js";
import path from "path";
import fs from "fs";
import { io } from '../server.js'; // adjust path as needed
import Region from "../models/Region.js";

// Global variables
const currency = 'PHP';
const deliveryCharge = 0;

// Make sure to set STRIPE_SECRET_KEY in your .env file at the project root
// Example: STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in your environment variables. Please add it to your .env file.");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const generateOrderNumber = () => {
  return 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
};

// Placing orders using COD Method
const updateProductStock = async (items) => {
  try {
    console.log("[updateProductStock] Called with items:", items);
    const updatePromises = items.map(async (item) => {
      const productId = item.productId || item._id;
      if (!productId) {
        console.log("[updateProductStock] Error: Missing productId/_id for item", item);
        throw new Error("Product ID is missing for an item.");
      }
      const product = await productModel.findById(productId);
      if (!product) {
        console.log(`[updateProductStock] Error: Product with ID ${productId} not found.`);
        throw new Error(`Product with ID ${productId} not found.`);
      }

      // If item has variationDetails, deduct from the correct option
      if (item.variationDetails && item.variationDetails.length > 0) {
        item.variationDetails.forEach(variationDetail => {
          const variation = product.variations.find(v => v.name === variationDetail.variationName);
          if (variation) {
            const option = variation.options.find(opt => opt.name === variationDetail.optionName);
            if (option) {
              if (option.quantity < item.quantity) {
                console.log(`[updateProductStock] Error: Not enough stock for ${variationDetail.variationName} - ${variationDetail.optionName}`);
                throw new Error(`Not enough stock for ${variationDetail.variationName} - ${variationDetail.optionName}`);
              }
              option.quantity -= item.quantity;
              console.log(`[updateProductStock] Deducted ${item.quantity} from ${variationDetail.variationName} - ${variationDetail.optionName}. New quantity: ${option.quantity}`);
            } else {
              console.log(`[updateProductStock] Option not found: ${variationDetail.optionName} in variation ${variationDetail.variationName}`);
            }
          } else {
            console.log(`[updateProductStock] Variation not found: ${variationDetail.variationName}`);
          }
        });
        await product.save();
      } else {
        if (typeof product.quantity === 'number') {
          const updatedQuantity = product.quantity - item.quantity;
          console.log(`[updateProductStock] Product: ${product.name} (${productId}), Current: ${product.quantity}, Deduct: ${item.quantity}, New: ${updatedQuantity}`);
          if (updatedQuantity < 0) {
            console.log(`[updateProductStock] Error: Not enough stock for product ID ${productId}.`);
            throw new Error(`Not enough stock for product ID ${productId}.`);
          }
          await productModel.findByIdAndUpdate(productId, { quantity: updatedQuantity });
          console.log(`[updateProductStock] Stock updated for product ID ${productId}.`);
        } else {
          console.log(`[updateProductStock] Warning: No base quantity field for product ${product.name} (${productId}), skipping base stock deduction.`);
        }
      }
    });
    await Promise.all(updatePromises);
    console.log("[updateProductStock] All stocks updated successfully.");
  } catch (error) {
    console.log("[updateProductStock] Error in updating product stock:", error);
    throw new Error(error.message);
  }
};
const placeOrder = async (req, res) => {
  const session = await orderModel.startSession();
  session.startTransaction();

  try {
    console.log('==== BACKEND ORDER PAYLOAD ====');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('==============================');

    const {
      userId,
      items,
      address,
      discountCode,
      amount,
      voucherAmount,
      voucherCode,
      variationAdjustment,
      variationDetails,
      variations,
      shippingFee,
      fromCart
    } = req.body;

    // Validate amount is positive
    if (amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Order total must be greater than zero." 
      });
    }

    // Fetch region fee
    let regionFee = 0;
    if (address && address.region) {
      const regionDoc = await Region.findOne({ name: new RegExp(`^${address.region}$`, 'i') });
      regionFee = regionDoc ? regionDoc.fee : 0;
    }

    // Calculate subtotal from items
    let subtotal = 0;
    const processedItems = Array.isArray(items) ? items.map((item) => {
      let variationAdjustment = 0;
      let variationDetails = [];
      if (item.variationDetails && Array.isArray(item.variationDetails) && item.variationDetails.length > 0) {
        variationAdjustment = item.variationDetails.reduce(
          (sum, v) => sum + (v.priceAdjustment || 0),
          0
        );
        variationDetails = item.variationDetails;
      } else if (item.variations && typeof item.variations === 'object') {
        variationDetails = Object.entries(item.variations).map(([variationName, v]) => ({
          variationName,
          optionName: v.name,
          priceAdjustment: v.priceAdjustment || 0,
        }));
        variationAdjustment = variationDetails.reduce(
          (sum, v) => sum + (v.priceAdjustment || 0),
          0
        );
      }
      return {
        ...item,
        variationAdjustment,
        variationDetails,
      };
    }) : [];

    // Calculate subtotal
    processedItems.forEach((item) => {
      let basePrice = (item.price || 0) + (item.variationAdjustment || 0);
      const discount = item.discount ? (basePrice * (item.discount / 100)) : 0;
      const finalPrice = Math.round((basePrice - discount) * 100) / 100;
      const itemTotal = Math.round((finalPrice * (item.quantity || 1)) * 100) / 100;
      subtotal = Math.round((subtotal + itemTotal) * 100) / 100;
    });

    const discount = req.body.discountAmount || 0;
    const voucher = voucherAmount || 0;
    const shipping = shippingFee || 0;
    
    // Final validation of calculated total
    const calculatedTotal = Math.round((subtotal - discount - voucher + shipping + regionFee) * 100) / 100;
    if (calculatedTotal <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Order total must be greater than zero after applying all discounts and vouchers." 
      });
    }
    // Debug logs for backend order calculation
    console.log('==== BACKEND ORDER DEBUG (STANDARDIZED) ====');
    console.log('Subtotal:', subtotal);
    console.log('Discount:', discount);
    console.log('Voucher:', voucher);
    console.log('Shipping Fee:', shipping);
    console.log('Region Fee:', regionFee);
    console.log('Final Calculated Total:', calculatedTotal);
    console.log('============================================');

    const orderData = {
      userId,
      items: processedItems,
      address,
      amount: calculatedTotal,
      paymentMethod: "COD",
      payment: false,
      date: Date.now(),
      discountCode: discountCode || null,
      discountAmount: discount || 0,
      voucherAmount: voucher || 0,
      voucherCode: voucherCode || null,
      orderNumber: generateOrderNumber(),
      variationDetails: variationDetails || null,
      variations: variations || null,
      shippingFee: shipping || 0,
      regionFee: regionFee,
      statusHistory: [{ status: "Order Placed", changedAt: new Date(), notes: "Order created" }],
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save({ session });
    console.log('[placeOrder] Order saved, attempting to update product stock...');
    try {
      await updateProductStock(processedItems);
      console.log('[placeOrder] Product stock updated successfully.');
    } catch (stockError) {
      console.error('[placeOrder] Stock deduction failed:', stockError);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Stock deduction failed: ${stockError.message}` });
    }

    // Only clear the cart if fromCart is true
    if (fromCart) {
      await userModel.findByIdAndUpdate(userId, { cartData: {} }, { session });
    }

    if (voucherCode) {
      const userVoucherUpdated = await userModel.updateOne(
        { _id: userId, "claimedVouchers.voucherCode": voucherCode },
        { $set: { "claimedVouchers.$.isActive": false } },
        { session }
      );

      if (userVoucherUpdated.modifiedCount === 0) {
        const user = await userModel.findById(userId);
        if (user?.email) {
          const subscriber = await Subscriber.findOne({
            email: { $regex: "^" + user.email.trim() + "$", $options: "i" },
            discountCode: { $regex: "^" + voucherCode.trim() + "$", $options: "i" }
          }).session(session);

          if (subscriber) {
            await Subscriber.updateOne(
              { _id: subscriber._id, discountCode: voucherCode },
              {
                $unset: { discountCode: 1 },
                $set: { isActive: false, usedAt: new Date() }
              },
              { session }
            );
          }
        }
      }
    }

    io.to(newOrder.userId.toString()).emit('newOrder', newOrder);
    io.to('admin_room').emit('newOrderAdmin', newOrder);
    io.to(`order_${newOrder._id.toString()}`).emit('orderStatusUpdate', newOrder);

    await session.commitTransaction();
    session.endSession();

    return res.json({ success: true, message: "Order Placed", order: newOrder, jtTracking: newOrder.jtTrackingNumber, shippingFee: newOrder.shippingFee });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Error placing order:", error);
    return res.status(500).json({ success: false, message: "Error placing order." });
  }
};



const placeOrderStripe = async (req, res) => {
  try {
    const { userId, items, amount, address, voucherAmount, voucherCode, variationAdjustment, shippingFee = 0 } = req.body;
    const { origin } = req.headers;

    // Use frontend-calculated finalPrice for each item
    let updatedItems = [];
    let subtotal = 0;
    for (const item of items) {
      let itemPrice = item.finalPrice;
      let itemTotal = itemPrice * item.quantity;
      updatedItems.push({ ...item, price: parseFloat(itemPrice.toFixed(2)) });
      subtotal += itemTotal;
    }

    // Stripe-style calculation: subtotal + shippingFee - voucherAmount
    let adjustedAmount = subtotal + shippingFee - (voucherAmount || 0);
    console.log('[STRIPE DEBUG] subtotal:', subtotal, 'shippingFee:', shippingFee, 'voucherAmount:', voucherAmount, 'adjustedAmount:', adjustedAmount);
    let displayAmount = parseFloat(adjustedAmount.toFixed(2));
    const finalAmount = Math.round(adjustedAmount * 100); // in cents

    const orderData = {
      userId,
      items: updatedItems,
      address,
      amount: displayAmount,
      paymentMethod: "Stripe",
      payment: false,
      date: Date.now(),
      voucherAmount: voucherAmount || 0,
      voucherCode: voucherCode || null,
      orderNumber: generateOrderNumber(),
      shippingFee: shippingFee || 0,
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    // Build Stripe line_items with correct price (use finalPrice)
    const line_items = updatedItems.map((item) => {
      const unitPrice = Math.round((item.price) * 100);
      return {
        price_data: {
          currency: "PHP",
          product_data: { name: item.name },
          unit_amount: unitPrice,
        },
        quantity: item.quantity,
      };
    });
    if (shippingFee && shippingFee > 0) {
      line_items.push({
        price_data: {
          currency: "PHP",
          product_data: { name: "Shipping Fee" },
          unit_amount: Math.round(shippingFee * 100),
        },
        quantity: 1,
      });
    }
    // Remove negative line item logic for voucher/discount
    // Instead, use Stripe coupons for discounts
    let couponId = null;
    if (voucherAmount && voucherAmount > 0) {
      // Create a Stripe coupon for the voucher amount
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(voucherAmount * 100),
        currency: 'PHP',
        name: voucherCode || 'Voucher Discount',
        duration: 'once',
      });
      couponId = coupon.id;
    }

    console.log('Order:', newOrder);
    console.log('Line items:', line_items);

    const session = await stripe.checkout.sessions.create({
      success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
      cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
      line_items,
      mode: "payment",
      discounts: couponId ? [{ coupon: couponId }] : [],
    });

    res.json({ success: true, session_url: session.url });
  } catch (error) {
    console.error("Stripe payment error:", error);
    res.json({ success: false, message: error.message });
  }
};



const verifyStripe = async (req, res) => {
  try {
    const { orderId, success, userId } = req.body;

    if (!orderId || !userId) {
      return res.status(400).json({ success: false, message: "Order ID and User ID are required." });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.payment) {
      return res.status(400).json({ success: false, message: "Order already processed." });
    }

    if (success === true || success === "true") {
      console.log("💳 Stripe Payment Successful. Processing order...");

       // ✅ Deduct Stock
       for (const item of order.items) {
        console.log("📦 Processing order item:", item);

        const product = await productModel.findById(item.productId);
        if (!product) {
          console.warn(`⚠️ Product not found: ${item.productId}`);
          continue;
        }

        console.log("📦 Found product:", product);

        if (item.variationId) {
          let variationUpdated = false;

          // Checking product variations
          for (let variation of product.variations) {
            console.log(`🔍 Checking variation: ${variation.name}`);

            // Find the variation option by ID
            const option = variation.options.find(
              (opt) => opt._id.toString() === item.variationId.toString()
            );

            if (option) {
              console.log(
                `🔍 Found option: ${option.name}, Available quantity: ${option.quantity}`
              );

              // Check if there's enough stock
              if (option.quantity >= item.quantity) {
                option.quantity -= item.quantity; // Deduct the quantity from selected option
                await product.save(); // Save product after stock deduction
                console.log(
                  `📦 Stock updated for variation: ${variation.name} - option: ${option.name}. Quantity left: ${option.quantity}`
                );

                // If stock hits 0, send instruction message
                if (option.quantity === 0) {
                  console.log(
                    `⚠️ Stock for variation: ${variation.name} - option: ${option.name} has hit 0. Please restock.`
                  );
                }

                variationUpdated = true;
              } else {
                console.warn(
                  `⚠️ Not enough stock for variation: ${variation.name} - option: ${option.name}. Available: ${option.quantity}, Requested: ${item.quantity}`
                );
              }
              break;
            } else {
              console.warn(
                `⚠️ Variation option not found for variation: ${variation.name}, option ID: ${item.variationId}`
              );
            }
          }

          if (!variationUpdated) {
            console.warn(
              `⚠️ Variation option ID not matched or insufficient stock for variation: ${item.variationId}`
            );
          }
        } else {
          // No variation, deduct from base product stock
          console.log(`🔍 Current stock for ${product.name}: ${product.variations[0].options[0].quantity}`);
          console.log(`🔍 Quantity to deduct: ${item.quantity}`);

          if (product.variations[0].options[0].quantity >= item.quantity) {
            product.variations[0].options[0].quantity -= item.quantity; // Deduct from base stock
            await product.save(); // Save product after stock deduction
            console.log(
              `📦 Base stock updated for product: ${product.name}. Quantity left: ${product.variations[0].options[0].quantity}`
            );

            // If stock hits 0, send instruction message
            if (product.variations[0].options[0].quantity === 0) {
              console.log(
                `⚠️ Stock for product: ${product.name} has hit 0. Please restock.`
              );
            }
          } else {
            console.warn(
              `⚠️ Not enough base stock for product: ${product.name}. Available: ${product.variations[0].options[0].quantity}, Requested: ${item.quantity}`
            );
          }
        }
      }

      // Mark payment
      order.payment = true;
      order.status = "Order Placed";
      await order.save();

      // Clear user cart
      const user = await userModel.findById(userId);
      if (user) {
        user.cartData = [];
        await user.save();
        console.log(`🛒 Cart cleared for user ${userId}`);
      }

      // Deactivate voucher if used
      if (order.voucherCode) {
        console.log(`🎟️ Processing voucher usage: ${order.voucherCode}`);

        const updated = await userModel.updateOne(
          { _id: userId, "claimedVouchers.voucherCode": order.voucherCode },
          { $set: { "claimedVouchers.$.isActive": false } }
        );

        if (updated.modifiedCount === 0) {
          console.log("🔍 Checking for subscriber-based voucher...");
          const user = await userModel.findById(userId);
          if (user?.email) {
            const subscriber = await Subscriber.findOne({
              email: { $regex: `^${user.email.trim()}$`, $options: "i" },
              discountCode: { $regex: `^${order.voucherCode.trim()}$`, $options: "i" },
            });

            if (subscriber) {
              await Subscriber.updateOne(
                { _id: subscriber._id, discountCode: order.voucherCode },
                {
                  $unset: { discountCode: 1 },
                  $set: { isActive: false, usedAt: new Date() },
                }
              );
              console.log("✅ Subscriber voucher deactivated");
            }
          }
        }
      }

      // Emit WebSocket events
      io.to(order.userId.toString()).emit('newOrder', order);
      io.to('admin_room').emit('newOrderAdmin', order);
      io.to(`order_${order._id.toString()}`).emit('orderStatusUpdate', order);

      return res.json({ success: true, message: "Order verified and processed.", order });
    } else {
      return res.json({ success: false, message: "Stripe payment was not successful." });
    }

  } catch (error) {
    console.error("❌ Error verifying Stripe payment:", error);
    return res.status(500).json({ success: false, message: "Server error while verifying order." });
  }
};




const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const userOrders = async (req, res) => {
  try {
    const { userId } = req.body;
    const orders = await orderModel.find({ userId });
    const formattedOrders = orders.map(order => ({
      ...order.toObject(),
      _id: order._id.toString()
    }));
    res.json({ success: true, orders: formattedOrders });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    // Push new status to statusHistory
    order.status = status;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status, changedAt: new Date(), notes: "Status updated" });
    await order.save();
      const io = req.app.get('io'); // Get the io instance from app
      if (io) {
        io.to(order.userId.toString()).emit('orderUpdated', order);
        io.to('admin_room').emit('orderUpdatedAdmin', order);
        io.to(`order_${order._id.toString()}`).emit('orderStatusUpdate', order);
      }
    res.json({ success: true, message: "Status Updated" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};
const cancelOrder = async (req, res) => {
  const orderId = req.params.id;

  try {
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'Canceled') {
      return res.status(400).json({ success: false, message: 'Order is already canceled.' });
    }

    const session = await orderModel.startSession();
    session.startTransaction();

    try {
      order.status = 'Canceled';
      await order.save({ session });

      await Promise.all(
        order.items.map(async (item) => {
          const product = await productModel.findById(item.productId);
          if (product) {
            product.quantity += item.quantity;
            await product.save({ session });
          }
        })
      );

      await session.commitTransaction();
      res.json({ success: true, message: 'Order canceled successfully.' });
    } catch (transactionError) {
      await session.abortTransaction();
      console.error('Transaction aborted:', transactionError);
      res.status(500).json({ success: false, message: 'Error canceling order.' });
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const uploadReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No receipt file uploaded" });
    }

    // Add validation for orderData
    if (!req.body.orderData || req.body.orderData === 'undefined') {
      return res.status(400).json({ 
        success: false, 
        message: "Order data is required",
        receivedData: req.body
      });
    }

    let orderData;
    try {
      orderData = JSON.parse(req.body.orderData);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: "Invalid order data format",
        error: parseError.message,
        receivedData: req.body.orderData
      });
    }

    // Validate items before creating order
    if (!orderData.items || orderData.items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Order must contain at least one item" 
      });
    }

    // Check stock availability first
    for (const item of orderData.items) {
      const product = await productModel.findById(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productId} not found`
        });
      }

      // Check stock for variations or base product
      if (item.variationId) {
        // Variation stock check logic
        let hasStock = false;
        for (const variation of product.variations) {
          const option = variation.options.find(opt => 
            opt._id.toString() === item.variationId.toString()
          );
          if (option && option.quantity >= item.quantity) {
            hasStock = true;
            break;
          }
        }
        if (!hasStock) {
          return res.status(400).json({
            success: false,
            message: `Not enough stock for variation ${item.variationId}`
          });
        }
      } else {
        // Base product stock check
        if (product.variations[0].options[0].quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Not enough stock for ${product.name}`
          });
        }
      }
    }

    // Create the order with receipt information
    const newOrder = new orderModel({
      ...orderData,
      date: new Date(),
      payment: false,
      paymentMethod: "receipt_upload",
      receiptImage: {
        filename: req.file.filename,
        path: req.file.path,
        mimetype: req.file.mimetype
      },
      orderNumber: generateOrderNumber(),
      status: 'Order Placed' // Ensure status is set
    });

    // Save the order
    await newOrder.save();

    // Update product stock
    for (const item of newOrder.items) {
      const product = await productModel.findById(item.productId);
      if (item.variationId) {
        // Update variation stock
        for (const variation of product.variations) {
          const option = variation.options.find(opt => 
            opt._id.toString() === item.variationId.toString()
          );
          if (option) {
            option.quantity -= item.quantity;
            await product.save();
          }
        }
      } else {
        // Update base product stock
        product.variations[0].options[0].quantity -= item.quantity;
        await product.save();
      }
    }

    // Clear user cart
    if (newOrder.userId) {
      await userModel.findByIdAndUpdate(newOrder.userId, { cartData: {} });
    }

    // Handle voucher if used
    if (newOrder.voucherCode && newOrder.userId) {
      await userModel.updateOne(
        { _id: newOrder.userId, "claimedVouchers.voucherCode": newOrder.voucherCode },
        { $set: { "claimedVouchers.$.isActive": false } }
      );
    }

    // Emit WebSocket events
    io.to(newOrder.userId.toString()).emit('newOrder', newOrder);
    io.to('admin_room').emit('newOrderAdmin', newOrder);
    io.to(`order_${newOrder._id.toString()}`).emit('orderStatusUpdate', newOrder);

    return res.status(201).json({ 
      success: true, 
      message: "Order created successfully. Receipt uploaded and pending verification.",
      orderId: newOrder._id,
      order: newOrder // Include full order details in response
    });

  } catch (error) {
    console.error("Receipt upload error:", {
      message: error.message,
      stack: error.stack,
      receivedFiles: req.file,
      receivedBody: req.body
    });
    
    // If order was created but other operations failed, delete it
    if (error.orderId) {
      await orderModel.findByIdAndDelete(error.orderId);
    }

    return res.status(500).json({ 
      success: false, 
      message: "An unexpected error occurred",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Download or View Receipt
export const getReceipt = async (req, res) => {
  try {
    const order = await orderModel.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!order.receiptImage || !order.receiptImage.path) {
      return res.status(400).json({ success: false, message: "No receipt available" });
    }

    const receiptPath = path.resolve(order.receiptImage.path);

    // Check if file exists
    if (!fs.existsSync(receiptPath)) {
      return res.status(404).json({ success: false, message: "Receipt file not found" });
    }

    // Send file as a response
    res.download(receiptPath, `receipt_${order._id}.jpg`);
  } catch (error) {
    console.error("Error fetching receipt:", error);
    res.status(500).json({ success: false, message: "Error fetching receipt" });
  }
};

// Confirm Payment
export const confirmPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Missing order ID" });
    }

    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status === "confirmed" || order.payment === true) {
      return res.status(400).json({ success: false, message: "Payment already confirmed" });
    }

    order.status = "Order Placed";
    order.payment = true;
    await order.save();

    res.json({ success: true, message: "Payment confirmed successfully" });
  } catch (error) {
    console.error("Error confirming payment:", error);
    res.status(500).json({ success: false, message: "Failed to confirm payment" });
  }
};

// Get order details for payment
export const getOrderForPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const order = await orderModel.findOne({
      _id: orderId,
      userId,
      payment: false
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found or already paid" 
      });
    }

    // Calculate amount due (original amount minus any partial payments)
    const amountDue = order.amount - (order.paidAmount || 0);

    res.json({
      success: true,
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        amount: order.amount,
        amountDue,
        paymentMethod: order.paymentMethod,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching order for payment:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch order details" 
    });
  }
};

// Process payment for existing order
export const processPayment = async (req, res) => {
  try {
    const { orderId, paymentMethod, receipt } = req.body;
    const userId = req.userId;

    const order = await orderModel.findOne({
      _id: orderId,
      userId,
      payment: false
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found or already paid" 
      });
    }

    // Process payment based on method
    switch (paymentMethod.toLowerCase()) {
      case 'stripe':
        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(order.amount * 100), // in cents
          currency: 'php',
          metadata: { orderId: order._id.toString() }
        });

        // Update order with payment intent ID
        order.stripePaymentId = paymentIntent.id;
        await order.save();

        return res.json({ 
          success: true, 
          clientSecret: paymentIntent.client_secret 
        });

      case 'gcash':
        // Create GCash payment (implementation depends on your GCash integration)
        const gcashPayment = await createGcashPayment(order);
        
        // Update order with GCash payment ID
        order.gcashPaymentId = gcashPayment.id;
        await order.save();

        return res.json({ 
          success: true, 
          paymentUrl: gcashPayment.url 
        });

      case 'bank_transfer':
      case 'receipt_upload':
        if (!receipt) {
          return res.status(400).json({ 
            success: false, 
            message: "Payment receipt is required" 
          });
        }

        // Update order with receipt
        order.receiptImage = {
          filename: receipt.filename,
          path: receipt.path,
          mimetype: receipt.mimetype
        };
        order.paymentMethod = 'bank_transfer';
        order.status = 'payment_review';
        await order.save();

        return res.json({ 
          success: true, 
          message: "Payment receipt uploaded for review" 
        });

      default:
        return res.status(400).json({ 
          success: false, 
          message: "Unsupported payment method" 
        });
    }

  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to process payment" 
    });
  }
};

// Verify payment completion
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentMethod, paymentId } = req.body;
    const userId = req.userId;

    const order = await orderModel.findOne({
      _id: orderId,
      userId
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    if (order.payment) {
      return res.json({ 
        success: true, 
        message: "Order already paid" 
      });
    }

    let paymentVerified = false;

    switch (paymentMethod.toLowerCase()) {
      case 'stripe':
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
        paymentVerified = paymentIntent.status === 'succeeded';
        break;

      case 'gcash':
        // Verify GCash payment (implementation depends on your GCash integration)
        paymentVerified = await verifyGcashPayment(paymentId);
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          message: "Unsupported payment method for verification" 
        });
    }

    if (paymentVerified) {
      // Update order status
      order.payment = true;
      order.status = 'processing';
      order.paidAt = new Date();
      await order.save();

      // Emit WebSocket events
      io.to(order.userId.toString()).emit('orderPaid', order);
      io.to('admin_room').emit('orderPaidAdmin', order);

      return res.json({ 
        success: true, 
        message: "Payment verified successfully" 
      });
    } else {
      return res.json({ 
        success: false, 
        message: "Payment not yet completed" 
      });
    }

  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to verify payment" 
    });
  }
};


// Add to orderController.js

export const scanQrAndUpdateStatus = async (req, res) => {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({ success: false, message: "QR data is required" });
    }

    let orderData;
    try {
      orderData = JSON.parse(qrData);
    } catch (error) {
      return res.status(400).json({ success: false, message: "Invalid QR data format" });
    }

    const { orderId } = orderData;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID not found in QR data" });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Update status to "Ready for Pickup"
    order.status = "Ready for Pickup";
    order.statusHistory.push({
      status: "Ready for Pickup",
      changedAt: new Date(),
      notes: "Status updated via QR scan"
    });

    await order.save();

    // Emit WebSocket events
    io.to(order.userId.toString()).emit('orderUpdated', order);
    io.to('admin_room').emit('orderUpdatedAdmin', order);
    io.to(`order_${order._id.toString()}`).emit('orderStatusUpdate', order);

    return res.json({ 
      success: true, 
      message: "Order status updated to Ready for Pickup",
      order
    });

  } catch (error) {
    console.error("Error scanning QR and updating status:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createStripeCheckoutSession = async (req, res) => {
  console.log('createStripeCheckoutSession called', req.params, req.userId);
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const order = await orderModel.findOne({ _id: orderId, userId, payment: false });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found or already paid" });
    }

    // Build line items (include variationAdjustment and shipping fee)
    const line_items = order.items.map((item) => ({
      price_data: {
        currency: "PHP",
        product_data: { name: item.name },
        unit_amount: Math.round(((item.price || 0) + (item.variationAdjustment || 0)) * 100),
      },
      quantity: item.quantity,
    }));
    if (order.shippingFee && order.shippingFee > 0) {
      line_items.push({
        price_data: {
          currency: "PHP",
          product_data: { name: "Shipping Fee" },
          unit_amount: Math.round(order.shippingFee * 100),
        },
        quantity: 1,
      });
    }

    console.log('Order:', order);
    console.log('Line items:', line_items);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/orders?paymentSuccess=true&orderId=${order._id}`,
      cancel_url: `${process.env.FRONTEND_URL}/orders?paymentFailed=true&orderId=${order._id}`,
      customer_email: order.address?.email,
      metadata: { orderId: order._id.toString() },
    });

    res.json({ success: true, session_url: session.url });
  } catch (error) {
    console.error("Stripe Checkout error:", error);
    res.status(500).json({ success: false, message: "Failed to create Stripe Checkout session" });
  }
};

export {
  uploadReceipt,
  verifyStripe,
  placeOrder,
  cancelOrder,
  placeOrderStripe,
  allOrders,
  userOrders,
  updateStatus,
  updateProductStock,
};