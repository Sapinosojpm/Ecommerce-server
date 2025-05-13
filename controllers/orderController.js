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

// Global variables
const currency = 'PHP';
const deliveryCharge = 0;

// Gateway initialization
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const generateOrderNumber = () => {
  return 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
};

// Placing orders using COD Method
const updateProductStock = async (items) => {
  try {
    const updatePromises = items.map(async (item) => {
      if (!item.productId) {
        console.log("Error: Missing productId for item", item);
        throw new Error("Product ID is missing for an item.");
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "No items to order." });
      }
      

      const product = await productModel.findById(item.productId);
      if (!product) {
        console.log(`Error: Product with ID ${item.productId} not found.`);
        throw new Error(`Product with ID ${item.productId} not found.`);
      }

      const updatedQuantity = product.quantity - item.quantity;
      if (updatedQuantity < 0) {
        console.log(`Error: Not enough stock for product ID ${item.productId}.`);
        throw new Error(`Not enough stock for product ID ${item.productId}.`);
      }

      await productModel.findByIdAndUpdate(item.productId, { quantity: updatedQuantity });
    });

    await Promise.all(updatePromises);
  } catch (error) {
    console.log("Error in updating product stock:", error);
    throw new Error(error.message);
  }
};
const placeOrder = async (req, res) => {
  const session = await orderModel.startSession();
  session.startTransaction();

  try {
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
      variations
    } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid total amount." });
    }

    const safeVariation = typeof variationAdjustment === 'number' ? variationAdjustment : 0;
    const adjustedAmount = Math.max(amount + safeVariation - (voucherAmount || 0), 0);
    let totalAmount = adjustedAmount;

    if (discountCode) {
      const subscriber = await Subscriber.findOne({ discountCode }).session(session);

      if (!subscriber || subscriber.isUsed) {
        await session.abortTransaction();
        return res.json({ success: false, message: "Invalid or already used discount code." });
      }

      await Subscriber.findByIdAndUpdate(
        subscriber._id,
        { $unset: { discountCode: 1 }, isUsed: true },
        { session }
      );
    }

    for (const item of items) {
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

    const orderData = {
      userId,
      items,
      address,
      amount: totalAmount,
      paymentMethod: "COD",
      payment: false,
      date: Date.now(),
      discountCode: discountCode || null,
      voucherAmount: voucherAmount || 0,
      voucherCode: voucherCode || null,
      orderNumber: generateOrderNumber(),
      variationDetails: variationDetails || null,
      variations: variations || null,
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save({ session });

    await userModel.findByIdAndUpdate(userId, { cartData: {} }, { session });

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

    return res.json({ success: true, message: "Order Placed", order: newOrder });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Error placing order:", error);
    return res.status(500).json({ success: false, message: "Error placing order." });
  }
};



const placeOrderStripe = async (req, res) => {
  try {
    const { userId, items, amount, address, voucherAmount, voucherCode, variationAdjustment } = req.body;
    const { origin } = req.headers;

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid total amount." });
    }

    const safeVariation = typeof variationAdjustment === 'number' ? variationAdjustment : 0;
    const adjustedAmount = Math.max(amount + safeVariation - (voucherAmount || 0), 0);
    const totalAmount = adjustedAmount;

    // 🔥 Add orderNumber here
    const orderData = {
      userId,
      items,
      address,
      amount: totalAmount,
      paymentMethod: "Stripe",
      payment: false,
      date: Date.now(),
      voucherAmount: voucherAmount || 0,
      voucherCode: voucherCode || null,
      orderNumber: generateOrderNumber(), // 🔥 Add this
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    const line_items = items.map((item) => {
      const itemPrice = Math.round((adjustedAmount / items.length) * 100);
      return {
        price_data: {
          currency: "PHP",
          product_data: { name: item.name },
          unit_amount: itemPrice,
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
      cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
      line_items,
      mode: "payment",
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
    const order = await orderModel.findByIdAndUpdate(orderId, { status }, { new: true });
    
    if (order) {
      const io = req.app.get('io'); // Get the io instance from app
      if (io) {
        io.to(order.userId.toString()).emit('orderUpdated', order);
        io.to('admin_room').emit('orderUpdatedAdmin', order);
        io.to(`order_${order._id.toString()}`).emit('orderStatusUpdate', order);
      }
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

export {
  uploadReceipt,
  verifyStripe,
  placeOrder,
  cancelOrder,
  placeOrderStripe,
  allOrders,
  userOrders,
  updateStatus,
  updateProductStock
};