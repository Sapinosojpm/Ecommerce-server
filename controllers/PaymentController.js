import axios from "axios";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import dotenv from "dotenv";
import Subscriber from "../models/subscriber.js";
import { disableVoucherForUser } from "../controllers/VoucherAmountController.js"; // Adjust the path as needed

dotenv.config(); // Load environment variables

const generateOrderNumber = () => {
  return 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
};

const placeOrderGcash = async (req, res) => {
  try {
    const {
      userId,
      items,
      address,
      region,
      amount,
      voucherCode,
      voucherAmount,
      variationAdjustment,
    } = req.body;
    console.log("Request Body:", req.body);
    console.log("Voucher Amount:", voucherAmount);
    console.log("Voucher Code:", voucherCode); // Debugging: Log the voucher code
    console.log("variation adjustment:", variationAdjustment); // Debugging: Log the voucher code
    // Ensure the amount is a number and valid
    if (typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid amount received from frontend.",
        });
    }

    // Safely handle undefined/null variationAdjustment
    const safeVariation =
      typeof variationAdjustment === "number" ? variationAdjustment : 0;

    // Adjust the amount by subtracting the voucherAmount (if any)
    const adjustedAmount = Math.max(
      amount + safeVariation - (voucherAmount || 0),
      0
    ); // Ensure non-negative amount
    console.log("🎟️ Adjusted Amount after Voucher:", adjustedAmount);

    // Convert the adjusted amount to centavos (multiply by 100)
    const finalAmount = Math.round(adjustedAmount * 100); // Ensure it's an integer
    console.log("🤑 Final Amount in Centavos:", finalAmount);

    // Validate stock and prepare updated items
    let updatedItems = [];
    for (const item of items) {
      const product = await productModel.findById(item._id);
      if (!product) {
        return res
          .status(404)
          .json({
            success: false,
            message: `Product with ID ${item._id} not found.`,
          });
      }
      if (product.quantity < item.quantity) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Not enough stock for ${product.name}.`,
          });
      }

      // Calculate the discounted price for the item (if applicable)
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
      amount: adjustedAmount, // Use the adjusted amount
      paymentMethod: "GCash",
      payment: false,
      date: Date.now(),
      region,
      voucherCode, // Ensure voucherCode is passed
      voucherAmount: voucherAmount || 0, // Ensure voucherAmount is passed
    });

    const newOrder = await orderModel.create({
      userId,
      items: updatedItems,
      address,
      amount: adjustedAmount, // Use the adjusted amount
      paymentMethod: "GCash",
      payment: false,
      date: Date.now(),
      region,
      voucherCode, // Ensure voucherCode is passed
      voucherAmount: voucherAmount || 0, // Ensure voucherAmount is passed
      orderNumber: generateOrderNumber(), // 🔥 Add this
    });

    console.log("📌 New Order ID:", newOrder._id);

    // Step 1: Create Payment Intent
    const paymentIntentResponse = await axios.post(
      "https://api.paymongo.com/v1/payment_intents",
      {
        data: {
          attributes: {
            amount: finalAmount, // Send the final amount in centavos
            payment_method_allowed: ["gcash"],
            currency: "PHP",
            capture_type: "automatic",
            description: `Payment for Order ID: ${newOrder._id}`,
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            process.env.PAYMONGO_SECRET_KEY
          ).toString("base64")}`,
        },
      }
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
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            process.env.PAYMONGO_SECRET_KEY
          ).toString("base64")}`,
        },
      }
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
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            process.env.PAYMONGO_SECRET_KEY
          ).toString("base64")}`,
        },
      }
    );

    const paymentUrl =
      attachResponse.data.data.attributes.next_action?.redirect.url;
    if (!paymentUrl) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to generate payment URL." });
    }

    res.json({ success: true, paymentUrl });
  } catch (error) {
    console.error(
      "❌ Error in GCash Order:",
      error.response?.data || error.message
    );
    res
      .status(500)
      .json({
        success: false,
        message: "Something went wrong with the GCash payment.",
      });
  }
};

// Verify GCash Payment
const verifyGCashPayment = async (req, res) => {
  try {
    const { orderId, payment_intent_id } = req.query;

    console.log("🔍 Verifying GCash Payment...");
    console.log("📌 Order ID:", orderId);
    console.log("📌 Payment Intent ID:", payment_intent_id);

    if (!orderId || !payment_intent_id) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Order ID and Payment Intent ID are required.",
        });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      console.error("❌ Order not found:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    console.log("✅ Order Found:", JSON.stringify(order, null, 2));

    if (order.payment) {
      console.log("⛔ Order already processed:", orderId);
      return res
        .status(400)
        .json({ success: false, message: "Order already processed." });
    }

    const authHeader = {
      Authorization: `Basic ${Buffer.from(
        process.env.PAYMONGO_SECRET_KEY
      ).toString("base64")}`,
    };

    const paymentIntentResponse = await axios.get(
      `https://api.paymongo.com/v1/payment_intents/${payment_intent_id}`,
      { headers: authHeader }
    );

    const paymentStatus = paymentIntentResponse.data.data.attributes.status;
    console.log(`📢 Payment Status: ${paymentStatus}`);

    if (paymentStatus === "succeeded") {
      console.log("💰 Payment successful! Processing order...");

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

      // ✅ Mark Order as Paid
      order.payment = true;
      order.status = "order placed"; // Update status to "ordered"
      await order.save();
      console.log(`✅ Order ${order._id} marked as Paid.`);

      // ✅ Clear Cart
      const user = await userModel.findById(order.userId);
      if (user) {
        console.log(`🛒 Clearing cart for user: ${order.userId}`);
        user.cartData = [];
        await user.save();
      } else {
        console.warn(`⚠️ User not found: ${order.userId}`);
      }

      // ✅ Voucher Handling
      if (order.voucherCode) {
        console.log(`🎟️ Processing voucher usage: ${order.voucherCode}`);

        const userVoucherUpdated = await userModel.updateOne(
          {
            _id: order.userId,
            "claimedVouchers.voucherCode": order.voucherCode,
          },
          { $set: { "claimedVouchers.$.isActive": false } }
        );

        if (userVoucherUpdated.modifiedCount === 0) {
          console.log("🔍 Checking for Subscriber voucher...");

          if (!user || !user.email) {
            console.error(
              "❌ User email missing. Cannot process subscriber voucher."
            );
          } else {
            const subscriber = await Subscriber.findOne({
              email: { $regex: "^" + user.email.trim() + "$", $options: "i" },
              discountCode: {
                $regex: "^" + order.voucherCode.trim() + "$",
                $options: "i",
              },
            });

            if (subscriber) {
              const subscriberVoucherRemoved = await Subscriber.updateOne(
                { _id: subscriber._id, discountCode: order.voucherCode },
                {
                  $unset: { discountCode: 1 },
                  $set: { isActive: false, usedAt: new Date() },
                }
              );

              if (subscriberVoucherRemoved.modifiedCount > 0) {
                console.log(
                  `🎟️ Voucher removed from subscriber: ${user.email}`
                );
              } else {
                console.log("❌ Failed to remove subscriber voucher.");
              }
            } else {
              console.log("❌ Subscriber voucher not found.");
            }
          }
        } else {
          console.log(`🎟️ Voucher disabled for user ${order.userId}`);
        }
      }

      console.log("✅ Payment verification completed.");

      return res.status(200).json({
        success: true,
        message: "Payment successful.",
        redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentSuccess=true&orderId=${order._id}`,
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "Payment failed.",
        redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentFailed=true&orderId=${order._id}`,
      });
    }
  } catch (error) {
    console.error("❌ Error in verifyGCashPayment:", error);
    res
      .status(500)
      .json({ success: false, message: `An error occurred: ${error.message}` });
  }
};

export { placeOrderGcash, verifyGCashPayment };
