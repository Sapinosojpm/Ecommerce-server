import axios from "axios";
import orderModel from "../models/orderModel.js";
import productModel from "../models/productModel.js";
import dotenv from "dotenv";
import crypto from 'crypto';
dotenv.config();

// Utility function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced webhook handler with better logging and status handling
export const handlePaymongoWebhook = async (req, res) => {
  console.log('[Webhook] Raw body:', req.body);
  console.log('[Webhook] Headers:', req.headers);
  
  try {
    const signature = req.headers['paymongo-signature'];
    console.log('[Webhook] Received signature:', signature);
    
    if (!verifyWebhookSignature(req.body, signature)) {
      console.error('[Webhook] Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    console.log('[Webhook] Full event data:', JSON.stringify(event, null, 2));

    if (event.type === 'payment.paid' || event.type === 'checkout_session.paid') {
      const attributes = event.data.attributes;
      const metadata = attributes.metadata || {};
      const orderId = metadata.orderId;

      if (!orderId) {
        console.error('[Webhook] Missing orderId in metadata');
        return res.status(400).send('Missing orderId');
      }

      console.log('[Webhook] Processing successful payment for order:', orderId);

      // Update order payment status first
      const updatedOrder = await orderModel.findByIdAndUpdate(
        orderId,
        {
          payment: true,
          paymentStatus: "paid",
          status: "Order Placed", // Changed to match old working status
          paymentMethod: attributes.payment_method_type || "Card" // Add payment method
        },
        { new: true }
      );

      if (updatedOrder) {
        try {
          // Enhanced stock deduction with variation support
          for (const item of updatedOrder.items) {
            const product = await productModel.findById(item.productId);
            if (!product) continue;

            if (item.variationId) {
              // Handle variation stock
              for (let variation of product.variations) {
                const option = variation.options.find(
                  opt => opt._id.toString() === item.variationId.toString()
                );
                if (option) {
                  option.quantity -= item.quantity;
                  await product.save();
                  console.log(`[Webhook] Stock updated for variation ${variation.name} - ${option.name}`);
                  break;
                }
              }
            } else {
              // Handle base product stock
              if (product.variations.length > 0 && product.variations[0].options.length > 0) {
                product.variations[0].options[0].quantity -= item.quantity;
                await product.save();
                console.log('[Webhook] Base stock updated');
              }
            }
          }
          console.log('[Webhook] Stock deducted successfully');
        } catch (stockError) {
          console.error('[Webhook] Error deducting stock:', stockError);
          // Continue even if stock deduction fails
        }

        console.log('[Webhook] Order updated successfully');
      } else {
        console.warn('[Webhook] Order not found for ID:', orderId);
      }
    } else {
      console.log('[Webhook] Ignored event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

const verifyWebhookSignature = (payload, signature) => {
  try {
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook] Missing webhook secret');
      return false;
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = hmac.update(JSON.stringify(payload)).digest('hex');
    return signature === digest;
  } catch (error) {
    console.error('[Webhook] Signature verification failed:', error);
    return false;
  }
};

export const placeOrderPaymongo = async (req, res) => {
  try {
    const {
      userId,
      items,
      address,
      voucherCode,
      voucherAmount = 0,
      discountAmount = 0,
      shippingFee = 0,
      paymentMethod,
      ...restOrderData
    } = req.body;

    // Calculate amounts
    const subtotal = items.reduce((sum, item) => {
      const basePrice = item.finalPrice || item.price;
      return sum + (basePrice * item.quantity);
    }, 0);
    const finalAmount = Math.round((subtotal - discountAmount - voucherAmount + shippingFee) * 100) / 100;
    const amountInCentavos = Math.round(finalAmount * 100);

    if (typeof finalAmount !== "number" || finalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order amount",
      });
    }

    // Create order first
    const order = await orderModel.create({
      userId,
      items,
      amount: finalAmount,
      address,
      paymentMethod: paymentMethod === "card" ? "Credit/Debit Card" : paymentMethod,
      payment: false,
      date: new Date(),
      voucherCode,
      voucherAmount,
      discountAmount,
      shippingFee,
      status: "Pending",
      orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...restOrderData
    });

    // Payment method mapping
    const paymentMethodMap = {
      gcash: {
        type: "gcash",
        sourceType: "gcash"
      },
      grab_pay: {
        type: "grab_pay",
        sourceType: "grab_pay"
      },
      card: {
        type: "card",
        sourceType: null  // Cards use payment intents
      }
    };

    const normalizedPaymentMethod = paymentMethodMap[paymentMethod.toLowerCase()];
    
    if (!normalizedPaymentMethod) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method: ${paymentMethod}`,
        supportedMethods: Object.keys(paymentMethodMap)
      });
    }

    // E-wallet payments (GCash, GrabPay)
    if (normalizedPaymentMethod.sourceType) {
      const sourceResponse = await axios.post(
        "https://api.paymongo.com/v1/sources",
        {
          data: {
            attributes: {
              amount: amountInCentavos,
              currency: "PHP",
              redirect: {
                success: `${process.env.FRONTEND_URL}/verify-payment?orderId=${order._id}&status=success`,
                failed: `${process.env.FRONTEND_URL}/verify-payment?orderId=${order._id}&status=failed`
              },
              type: normalizedPaymentMethod.sourceType,
              billing: {
                name: `${address.firstName} ${address.lastName}`,
                email: address.email,
                phone: address.phone
              }
            }
          }
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}`,
            "Content-Type": "application/json"
          }
        }
      );

      return res.json({
        success: true,
        paymentUrl: sourceResponse.data.data.attributes.redirect.checkout_url,
        orderId: order._id,
        orderNumber: order.orderNumber,
        sourceId: sourceResponse.data.data.id,
        redirect: true
      });
    }

    // Card payments
    if (normalizedPaymentMethod.type === "card") {
      const checkoutSession = await axios.post(
        "https://api.paymongo.com/v1/checkout_sessions",
        {
          data: {
            attributes: {
              billing: {
                name: `${address.firstName} ${address.lastName}`,
                email: address.email,
                phone: address.phone
              },
              send_email_receipt: true,
              show_description: true,
              show_line_items: true,
              line_items: [
                {
                  currency: "PHP",
                  amount: amountInCentavos,
                  name: `Order #${order.orderNumber}`,
                  quantity: 1,
                },
              ],
              payment_method_types: ["card"],
              description: `Payment for Order #${order.orderNumber}`,
              reference_number: order.orderNumber,
              redirect: {
                success: `${process.env.FRONTEND_URL}/verify-payment?orderId=${order._id}&status=success`,
                failed: `${process.env.FRONTEND_URL}/verify-payment?orderId=${order._id}&status=failed`
              },
              metadata: {
                orderId: order._id.toString()
              }
            }
          }
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}`,
            "Content-Type": "application/json"
          }
        }
      );

      return res.json({
        success: true,
        redirect: true,
        paymentUrl: checkoutSession.data.data.attributes.checkout_url,
        orderId: order._id,
        orderNumber: order.orderNumber
      });
    }

    return res.status(400).json({
      success: false,
      message: `Unsupported payment method: ${paymentMethod}`
    });

  } catch (error) {
    console.error("Paymongo Error:", {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: "Payment processing failed",
      error: error.response?.data?.errors?.[0]?.detail || error.message,
    });
  }
};

// Enhanced verifyPayment with polling mechanism
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, payment_intent_id, status } = req.query;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Missing orderId"
      });
    }

    const existingOrder = await orderModel.findById(orderId);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // If status is failed from redirect
    if (status === 'failed') {
      await orderModel.findByIdAndUpdate(orderId, {
        payment: false,
        paymentStatus: "failed",
        status: "Payment Failed"
      });
      return res.json({
        success: false,
        message: "Payment failed",
        redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentFailed=true&orderId=${orderId}`
      });
    }

    // If status is success but no payment_intent_id
    if (status === 'success' && !payment_intent_id) {
      // Check if order is already marked as paid (webhook might have processed it)
      if (existingOrder.payment) {
        return res.json({
          success: true,
          message: "Payment already processed",
          redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentSuccess=true&orderId=${orderId}`
        });
      }
      
      // Wait a bit in case webhook is delayed
      await delay(2000);
      const refreshedOrder = await orderModel.findById(orderId);
      if (refreshedOrder.payment) {
        return res.json({
          success: true,
          message: "Payment processed",
          redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentSuccess=true&orderId=${orderId}`
        });
      }
      
      return res.json({
        success: false,
        message: "Payment verification in progress",
        redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentPending=true&orderId=${orderId}`
      });
    }

    // If we have a payment_intent_id, verify it
    if (payment_intent_id) {
      let paymentIntentResponse;
      let paymentStatus;
      let attempts = 0;
      const maxAttempts = 5;
      
      do {
        paymentIntentResponse = await axios.get(
          `https://api.paymongo.com/v1/payment_intents/${payment_intent_id}`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}`,
            },
          }
        );
        
        paymentStatus = paymentIntentResponse.data.data.attributes.status;
        if (paymentStatus === "succeeded") break;
        attempts++;
        await delay(1500);
      } while (attempts < maxAttempts);

      // Get payment method details if available
      let paymentMethod = "Card";
      if (paymentIntentResponse.data.data.attributes.payment_method) {
        const pmResponse = await axios.get(
          `https://api.paymongo.com/v1/payment_methods/${paymentIntentResponse.data.data.attributes.payment_method}`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}`,
            },
          }
        );
        paymentMethod = pmResponse.data.data.attributes.type;
      }

      let order;
      switch (paymentStatus) {
        case "succeeded":
          // Verify the payment object
          const payments = await axios.get(
            `https://api.paymongo.com/v1/payments?payment_intent_id=${payment_intent_id}`,
            {
              headers: {
                Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}`,
              },
            }
          );

          if (payments.data.data.length > 0 && payments.data.data[0].attributes.status === "paid") {
            order = await orderModel.findByIdAndUpdate(orderId, {
              payment: true,
              paymentStatus: "paid",
              status: "Order Placed", // Changed to match old working status
              paymentMethod: paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)
            }, { new: true });

            // Deduct stock
            for (const item of order.items) {
              await productModel.findByIdAndUpdate(item.productId, {
                $inc: { stock: -item.quantity }
              });
            }

            return res.json({
              success: true,
              message: "Payment successful",
              redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentSuccess=true&orderId=${orderId}`
            });
          }
          break;
        
        default:
          order = await orderModel.findByIdAndUpdate(orderId, {
            payment: false,
            paymentStatus: "failed",
            status: "Payment Failed",
            paymentMethod: paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)
          }, { new: true });
          return res.json({
            success: false,
            message: "Payment failed or was cancelled",
            redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentFailed=true&orderId=${orderId}`
          });
      }
    }

    return res.json({
      success: false,
      message: "Payment verification in progress",
      redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentPending=true&orderId=${orderId}`
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    if (orderId) {
      await orderModel.findByIdAndUpdate(orderId, {
        payment: false,
        paymentStatus: "error",
        status: "Payment Error",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.response?.data || error.message
    });
  }
};