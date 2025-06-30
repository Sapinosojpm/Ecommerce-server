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
      shippingFee = 0
    } = req.body;
    console.log("Request Body:", req.body);
    console.log("Voucher Amount:", voucherAmount);
    console.log("Voucher Code:", voucherCode); // Debugging: Log the voucher code
    console.log("variation adjustment:", variationAdjustment); // Debugging: Log the voucher code
    console.log("Shipping Fee:", shippingFee);
    // Ensure the amount is a number and valid
    if (typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid amount received from frontend.",
        });
    }

    // Use frontend-calculated finalPrice for each item (like Stripe)
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
    console.log('[GCASH DEBUG] subtotal:', subtotal, 'shippingFee:', shippingFee, 'voucherAmount:', voucherAmount, 'adjustedAmount:', adjustedAmount);
    let displayAmount = parseFloat(adjustedAmount.toFixed(2));
    const finalAmount = Math.round(adjustedAmount * 100); // for payment API
    console.log("🎟️ Adjusted Amount after Voucher and Shipping:", displayAmount);
    console.log("🤑 Final Amount in Centavos:", finalAmount);

    // Prevent duplicate unpaid orders for the same user and items
    const existingOrder = await orderModel.findOne({
      userId,
      payment: false,
      address,
      amount,
      voucherCode: voucherCode || null,
      voucherAmount: voucherAmount || 0,
      shippingFee: shippingFee || 0,
      // Optionally, you can add more checks for items equality if needed
    });
    if (existingOrder) {
      console.log("Found existing unpaid order:", existingOrder._id);
      // Proceed to create payment intent for this order instead of creating a new one
      // Step 1: Create Payment Intent
      const finalAmount = Math.round(existingOrder.amount * 100);
      const paymentIntentResponse = await axios.post(
        "https://api.paymongo.com/v1/payment_intents",
        {
          data: {
            attributes: {
              amount: finalAmount,
              payment_method_allowed: ["gcash"],
              currency: "PHP",
              capture_type: "automatic",
              description: `Payment for Order ID: ${existingOrder._id}`,
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
              return_url: `${process.env.FRONTEND_URL}/verify-payment?orderId=${existingOrder._id}&payment_intent_id=${paymentIntentId}`,
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
      const paymentUrl = attachResponse.data.data.attributes.next_action?.redirect.url;
      if (!paymentUrl) {
        return res.status(500).json({ success: false, message: "Failed to generate payment URL." });
      }
      return res.json({ success: true, paymentUrl });
    }

    // Create Order (Not yet paid)
    console.log("Order Data before creation:", {
      userId,
      items: updatedItems,
      address,
      amount: displayAmount, // Use the rounded display amount
      paymentMethod: "GCash",
      payment: false,
      date: Date.now(),
      region,
      voucherCode, // Ensure voucherCode is passed
      voucherAmount: voucherAmount || 0, // Ensure voucherAmount is passed
      shippingFee,
    });

    const newOrder = await orderModel.create({
      userId,
      items: updatedItems,
      address,
      amount: displayAmount, // Use the rounded display amount
      paymentMethod: "GCash",
      payment: false,
      date: Date.now(),
      region,
      voucherCode, // Ensure voucherCode is passed
      voucherAmount: voucherAmount || 0, // Ensure voucherAmount is passed
      shippingFee,
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

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const verifyGCashPayment = async (req, res) => {
  console.log('🔔 verifyGCashPayment endpoint called', req.query);
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

    let paymentIntentResponse;
    let paymentStatus;
    let attempts = 0;
    const maxAttempts = 5;
    do {
      try {
        paymentIntentResponse = await axios.get(
          `https://api.paymongo.com/v1/payment_intents/${payment_intent_id}`,
          { headers: authHeader }
        );
      } catch (err) {
        console.error("❌ Error fetching payment intent from PayMongo:", err.response?.data || err.message);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch payment intent from PayMongo.",
          error: err.response?.data || err.message,
        });
      }
      paymentStatus = paymentIntentResponse.data.data.attributes.status;
      console.log(`📢 Payment Status (attempt ${attempts + 1}): ${paymentStatus}`);
      if (paymentStatus === "succeeded" || paymentStatus !== "processing") {
        break;
      }
      attempts++;
      await delay(1500); // wait 1.5 seconds before next poll
    } while (attempts < maxAttempts);
    console.log('Full PayMongo PaymentIntent Response:', JSON.stringify(paymentIntentResponse.data, null, 2));

    if (paymentStatus === "succeeded") {
      console.log("💰 Payment successful! Processing order...");

      // ✅ Deduct Stock
      for (const item of order.items) {
        console.log("📦 Processing order item:", item);

        // Use item.productId or fallback to item._id for product lookup
        const product = await productModel.findById(item.productId || item._id);
        if (!product) {
          console.warn(`⚠️ Product not found: ${item.productId || item._id}`);
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
      order.status = "Order Placed"; // Update status to "ordered"
      await order.save();
      console.log(`✅ Order ${order._id} marked as Paid (payment: ${order.payment})`);

      // ✅ Clear Cart
      // Only clear cart if order.fromCart is true
      if (order.fromCart) {
        const user = await userModel.findById(order.userId);
        if (user) {
          console.log(`🛒 Clearing cart for user: ${order.userId}`);
          user.cartData = [];
          await user.save();
        } else {
          console.warn(`⚠️ User not found: ${order.userId}`);
        }
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
        paymentStatus,
      });
    } else {
      return res.status(200).json({
        success: false,
        message: `Payment not successful. Status: ${paymentStatus}`,
        redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentFailed=true&orderId=${order._id}`,
        paymentStatus,
        paymongoResponse: paymentIntentResponse.data,
      });
    }
  } catch (error) {
    console.error("❌ Error in verifyGCashPayment:", error);
    res
      .status(500)
      .json({ success: false, message: `An error occurred: ${error.message}` });
  }
};

// POST /api/payment/gcash/pay/:orderId
const payExistingOrderGcash = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await orderModel.findById(orderId);
    if (!order || order.payment) {
      return res.status(400).json({ success: false, message: "Order not found or already paid." });
    }
    // Use order.amount, order.items, etc. to create payment intent
    const finalAmount = Math.round(order.amount * 100); // in centavos
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
            description: `Payment for Order ID: ${order._id}`,
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}`,
        },
      }
    );
    const paymentIntentId = paymentIntentResponse.data.data.id;
    // Step 2: Create Payment Method
    const paymentMethodResponse = await axios.post(
      "https://api.paymongo.com/v1/payment_methods",
      {
        data: {
          attributes: {
            type: "gcash",
            billing: {
              name: order.address?.name || "Customer",
              email: order.address?.email || "customer@example.com",
              phone: order.address?.phone || "09123456789",
            },
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}`,
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
            return_url: `${process.env.FRONTEND_URL}/orders?paymentSuccess=true&orderId=${order._id}`,
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}`,
        },
      }
    );
    const paymentUrl = attachResponse.data.data.attributes.next_action?.redirect.url;
    if (!paymentUrl) {
      return res.status(500).json({ success: false, message: "Failed to generate payment URL." });
    }
    return res.json({ success: true, paymentUrl });
  } catch (error) {
    console.error("❌ Error in payExistingOrderGcash:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Something went wrong with the GCash payment." });
  }
};

export { placeOrderGcash, verifyGCashPayment, payExistingOrderGcash };
