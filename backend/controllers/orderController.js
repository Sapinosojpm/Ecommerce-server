import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";  // Ensure this is correctly imported
import Stripe from "stripe";
import Paymongo from 'paymongo-node'; // Ensure this package is installed
import axios from 'axios';
import Subscriber from "../models/subscriber.js"; // ✅ Use this instead

// Global variables
const currency = 'PHP';
const deliveryCharge = 0;

// Gateway initialization
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// const paymongo = new Paymongo(process.env.PAYMONGO_SECRET_KEY);



// Placing orders using COD Method
// Update the placeOrder function
// Function to place an order
const updateProductStock = async (items) => {
  try {
    const updatePromises = items.map(async (item) => {
      if (!item.productId) {
        console.log("Error: Missing productId for item", item);
        throw new Error("Product ID is missing for an item.");
      }

      const product = await productModel.findById(item.productId); // Find product by ID
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
    throw new Error(error.message); // Propagate the error if anything goes wrong
  }
};

// Function to place an order
const placeOrder = async (req, res) => {
  const session = await orderModel.startSession();
  session.startTransaction();

  try {
    const { userId, items, address, discountCode, amount, voucherAmount } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid total amount." });
    }
    const adjustedAmount = Math.max(amount - (voucherAmount || 0), 0); // Ensure non-negative amount
    console.log("🎟️ Adjusted Amount after Voucher:", adjustedAmount);
    
    let totalAmount = adjustedAmount;

    if (discountCode) {
      console.log(` Voucher received: ${discountCode}`); 
      const subscriber = await Subscriber.findOne({ discountCode }).session(session);

      if (!subscriber || subscriber.isUsed) {
        await session.abortTransaction();
        return res.json({ success: false, message: "Invalid or already used discount code." });
      }

      // Mark the voucher as used
      await Subscriber.findByIdAndUpdate(subscriber._id, { 
        $unset: { discountCode: "", discountPercent: "" },
        isUsed: true
      }, { session });
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
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save({ session });
    await userModel.findByIdAndUpdate(userId, { cartData: {} }, { session });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, message: "Order Placed", order: newOrder });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: "Error placing order." });
  }
};

const placeOrderStripe = async (req, res) => {
  try {
    const { userId, items, amount, address, voucherAmount } = req.body;
    const { origin } = req.headers;

    console.log("Received amount from frontend:", amount); // Debugging log

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid total amount." });
    }

    const adjustedAmount = Math.max(amount - (voucherAmount || 0), 0); // Ensure non-negative amount
    console.log("🎟️ Adjusted Amount after Voucher:", adjustedAmount);

    const totalAmount = adjustedAmount;
    console.log("Total amount received from frontend:", totalAmount); // Debugging log

    const orderData = {
      userId,
      items,
      address,
      amount: totalAmount, // Ensure this is the final amount
      paymentMethod: "Stripe",
      payment: false,
      date: Date.now(),
      voucherAmount: voucherAmount || 0,
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    // If a voucher was used, mark it as used
    if (req.body.discountCode) {
      await Subscriber.findOneAndUpdate(
        { discountCode: req.body.discountCode },
        { $unset: { discountCode: "", discountPercent: "" }, isUsed: true }
      );
    }

    const line_items = items.map((item) => {
      const itemPrice = Math.round((adjustedAmount / items.length) * 100); // Use adjustedAmount
      console.log(`Item: ${item.name}, Final Price: ${itemPrice / 100}`); // Debugging log
    
      return {
        price_data: {
          currency: "PHP",
          product_data: { name: item.name },
          unit_amount: itemPrice, // ✅ Use the discounted amount instead
        },
        quantity: item.quantity,
      };
    });
    
    console.log("Final total amount sent to Stripe:", totalAmount); // Debugging log

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

// Verify Stripe payment
const verifyStripe = async (req, res) => {
  const { orderId, success, userId } = req.body;
  try {
    if (success === 'true') {
      const order = await orderModel.findById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      for (let item of order.items) {
        const product = await productModel.findById(item._id);
        if (product) {
          const updatedQuantity = product.quantity - item.quantity;
          if (updatedQuantity < 0) {
            return res.json({ success: false, message: "Not enough stock for one or more items." });
          }
          await productModel.findByIdAndUpdate(item._id, { quantity: updatedQuantity }, { new: true });
        } else {
          return res.json({ success: false, message: `Product with ID ${item._id} not found.` });
        }
      }

      // ✅ Remove the discountCode and discountPercent after payment success
      if (order.discountCode) {
        const subscriber = await Subscriber.findOne({ discountCode: order.discountCode });
        if (subscriber) {
          await subscriber.updateOne({ $unset: { discountCode: "", discountPercent: "" } });
          console.log(`🎟️ Discount code removed: ${order.discountCode}`);
        } else {
          console.warn(`⚠️ No subscriber found with discount code: ${order.discountCode}`);
        }
      }

      // ✅ Disable the voucher
      if (order.voucherAmount > 0) {
        const user = await userModel.findById(order.userId);
        if (user) {
          const voucher = user.claimedVouchers.find(v => v.voucherAmount === order.voucherAmount);
          if (voucher) {
            await disableVoucherForUser(order.userId, voucher._id);
            console.log(`Voucher disabled: ${voucher._id}`);
          } else {
            console.log("Voucher not found in user claimedVouchers array");
          }
        } else {
          console.error(`❌ User not found: ${order.userId}`);
        }
      }

      await orderModel.findByIdAndUpdate(orderId, { payment: true });
      await userModel.findByIdAndUpdate(userId, { cartData: {} });

      res.json({ success: true });
    } else {
      await orderModel.findByIdAndDelete(orderId);
      res.json({ success: false });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// All orders data for Admin Panel
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// User Order Data for frontend
const userOrders = async (req, res) => {
  try {
    const { userId } = req.body;
    const orders = await orderModel.find({ userId });

    // Modify this part to extract only the ObjectId string
    const formattedOrders = orders.map(order => ({
      ...order.toObject(), // Convert to plain object
      _id: order._id.toString() // Extract ObjectId as string
    }));

    res.json({ success: true, orders: formattedOrders });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
}

const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    await orderModel.findByIdAndUpdate(orderId, { status });
    res.json({ success: true, message: "Status Updated" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


const cancelOrder = async (req, res) => {
  const orderId = req.params.id; // More descriptive variable name

  try {
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'Canceled') {
      return res.status(400).json({ success: false, message: 'Order is already canceled.' });
    }

    // Use a transaction (if your database supports it) for atomicity
    // This ensures that either all updates succeed or none do.
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
          } else {
            console.warn(`Product with ID ${item.productId} not found for restoration.`);
            // Consider throwing an error here if missing products are critical
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

export { verifyStripe, placeOrder, cancelOrder, placeOrderStripe, allOrders, userOrders, updateStatus, updateProductStock };
