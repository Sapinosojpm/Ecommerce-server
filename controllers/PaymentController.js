import axios from "axios";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import dotenv from "dotenv";
import Subscriber from "../models/subscriber.js";
import { disableVoucherForUser } from "../controllers/VoucherAmountController.js"; // Adjust the path as needed
dotenv.config(); // Load environment variables

const placeOrderGcash = async (req, res) => {
  try {
    const { userId, items, address, region, amount, discountCode, voucherAmount } = req.body;
    console.log("voucheramountdiscount: " + voucherAmount);
    console.log("✅ Received Amount from Frontend:", amount);

    const adjustedAmount = Math.max(amount - (voucherAmount || 0), 0); // Ensure non-negative amount
    console.log("🎟️ Adjusted Amount after Voucher:", adjustedAmount);
    
    const finalAmount = adjustedAmount * 100; // Convert to centavos
    console.log("🤑 Final Amount in Centavos:", finalAmount);

    let updatedItems = [];

    // Validate stock
    for (const item of items) {
      const product = await productModel.findById(item._id);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product with ID ${item._id} not found.` });
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ success: false, message: `Not enough stock for ${product.name}.` });
      }

      let itemPrice = product.discount
        ? parseFloat((product.price * (1 - product.discount / 100)).toFixed(2))
        : product.price;

      updatedItems.push({ ...item, price: itemPrice });
    }

    // Create Order (Not yet paid)
    console.log("Order Data before creation:", {
      userId,
      items: updatedItems,
      address,
      amount,
      paymentMethod: "GCash",
      payment: false,
      date: Date.now(),
      region,
      discountCode,
      voucherAmount: voucherAmount || 0,
    });
    
    const newOrder = await orderModel.create({
      userId,
      items: updatedItems,
      address,
      amount,
      paymentMethod: "GCash",
      payment: false,
      date: Date.now(),
      region,
      discountCode,
      voucherAmount: voucherAmount || 0,
    });

    console.log("📌 New Order ID:", newOrder._id);

    // If a voucher was used, mark it as used
    if (discountCode) {
      await Subscriber.findOneAndUpdate(
        { discountCode },
        { $unset: { discountCode: "", discountPercent: "" }, isUsed: true }
      );
    }

    // Step 1: Create Payment Intent
    const paymentIntentResponse = await axios.post(
      "https://api.paymongo.com/v1/payment_intents",
      {
        data: {
          attributes: {
            amount: finalAmount,
            payment_method_allowed: ["gcash"],
            currency: "PHP",
            capture_type: "automatic",
            description: `Payment for Order ID: ${newOrder._id}`,
          },
        },
      },
      { headers: { Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}` } }
    );

    const paymentIntentId = paymentIntentResponse.data.data.id;
    console.log("🆔 Payment Intent Created:", paymentIntentId);

    // Step 2: Create Payment Method
    const paymentMethodResponse = await axios.post(
      "https://api.paymongo.com/v1/payment_methods",
      {
        data: {
          attributes: {
            type: "gcash",
            billing: {
              name: "Customer",
              email: "customer@example.com",
              phone: "09123456789",
            },
          },
        },
      },
      { headers: { Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}` } }
    );

    const paymentMethodId = paymentMethodResponse.data.data.id;

    // Step 3: Attach Payment Method to Payment Intent
    const attachResponse = await axios.post(
      `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}/attach`,
      {
        data: {
          attributes: {
            payment_method: paymentMethodId,
            return_url: `${process.env.FRONTEND_URL}/verify-payment?orderId=${newOrder._id}&payment_intent_id=${paymentIntentId}`,
          },
        },
      },
      { headers: { Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}` } }
    );

    const paymentUrl = attachResponse.data.data.attributes.next_action?.redirect.url;
    if (!paymentUrl) {
      return res.status(500).json({ success: false, message: "Failed to generate payment URL." });
    }

    res.json({ success: true, paymentUrl });
  } catch (error) {
    console.error("❌ Error in GCash Order:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Something went wrong with the GCash payment." });
  }
};


const verifyGCashPayment = async (req, res) => {
  try {
      const { orderId, payment_intent_id } = req.query;
      if (!orderId || !payment_intent_id) {
          return res.status(400).json({ success: false, message: "Order ID and Payment Intent ID are required." });
      }

      const order = await orderModel.findById(orderId);
      if (!order) {
          return res.status(404).json({ success: false, message: "Order not found." });
      }

      const paymentIntentResponse = await axios.get(
          `https://api.paymongo.com/v1/payment_intents/${payment_intent_id}`,
          { headers: { Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}` } }
      );

      const paymentStatus = paymentIntentResponse.data.data.attributes.status;
      console.log(`📢 Payment Status: ${paymentStatus}`);

      if (paymentStatus === "succeeded") {
          // ✅ Deduct stock
          for (const item of order.items) {
              const product = await productModel.findById(item._id);
              if (product) {
                  if (product.quantity >= item.quantity) {
                      product.quantity -= item.quantity;
                      await product.save();
                      console.log(`✅ Stock updated for ${product.name}, new quantity: ${product.quantity}`);
                  } else {
                      console.warn(`⚠️ Not enough stock for ${product.name}, current stock: ${product.quantity}`);
                  }
              } else {
                  console.error(`❌ Product not found: ${item._id}`);
              }
          }

          // ✅ Mark order as paid
          order.payment = true;
          order.status = "Paid";
          await order.save();
          console.log(`✅ Order marked as paid: ${order._id}`);

          // ✅ Clear user's cart
          const user = await userModel.findById(order.userId);
          if (user) {
              user.cartData = [];
              await user.save();
              console.log(`🛒 Cart cleared for user: ${user._id}`);
          } else {
              console.error(`❌ User not found: ${order.userId}`);
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
          console.log(`Order Voucher Amount: ${order.voucherAmount}`);
          console.log(order);
          if (order.voucherAmount > 0) { // Check if a voucher was used
              const user = await userModel.findById(order.userId);
              if (user) {
                  console.log(`Attempting to disable voucher for user ${user._id}`);
                  console.log(`User's claimed vouchers:`, user.claimedVouchers);
                  // Find the voucher that was used.
                  const voucher = user.claimedVouchers.find(v => v.voucherAmount === order.voucherAmount);
                  if(voucher){
                      console.log(`Voucher found: ${voucher._id}`);
                      console.log(`Voucher to be disabled:`, voucher);
                      await disableVoucherForUser(order.userId, voucher._id);
                  }else{
                      console.log("voucher not found in user claimedVouchers array");
                  }
              } else {
                  console.error(`❌ User not found: ${order.userId}`);
              }
          } else {
              console.log("No voucher to disable for this order.");
          }

          return res.redirect(`${process.env.FRONTEND_URL}/orders?paymentSuccess=true`);
      } else {
          order.status = "Payment Failed";
          await order.save();
          console.error(`❌ Payment failed for order: ${order._id}`);
          return res.redirect(`${process.env.FRONTEND_URL}/orders?paymentFailed=true`);
      }
  } catch (error) {
      console.error("❌ Error in verifyGCashPayment:", error.response?.data || error.message);
      res.status(500).json({ success: false, message: `An error occurred: ${error.message}` });
  }
};
export { placeOrderGcash, verifyGCashPayment };
