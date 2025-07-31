import axios from "axios";
import orderModel from "../models/orderModel.js";
import productModel from "../models/productModel.js";
import dotenv from "dotenv";
import crypto from 'crypto';
dotenv.config();

// Utility function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Webhook Testing Endpoint (for development only)
export const testWebhook = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: "Test webhook not available in production" });
  }

  const { orderId, eventType = 'payment.paid', paymentMethod = 'gcash' } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, message: "orderId is required" });
  }

  const testEvent = {
    data: {
      attributes: {
        type: eventType,
        data: {
          attributes: {
            amount: 10000, // 100.00 PHP
            currency: 'PHP',
            status: eventType === 'payment.paid' ? 'paid' : 'failed',
            metadata: { orderId },
            payment_method_type: paymentMethod,
            source: {
              type: paymentMethod
            },
            billing: {
              name: "Test User",
              email: "test@example.com"
            }
          }
        }
      }
    }
  };

  try {
    // Process the test event, handlePaymongoWebhook sends the response itself
    await handlePaymongoWebhook({
      body: testEvent,
      headers: {
        'paymongo-signature': 'test_signature_skip_validation'
      }
    }, res);

    // DO NOT send response here again to avoid ERR_HTTP_HEADERS_SENT

  } catch (error) {
    // If handlePaymongoWebhook throws, send error response here
    res.status(500).json({
      success: false,
      message: "Test webhook processing failed",
      error: error.message
    });
  }
};


// Enhanced webhook handler
export const handlePaymongoWebhook = async (req, res) => {
  console.log('[Webhook] Received event');
  
  try {
    // Skip verification in development for testing
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Skipping signature verification in development mode');
    } else {
      const signature = req.headers['paymongo-signature'];
      if (!verifyWebhookSignature(req.body, signature)) {
        console.error('[Webhook] Invalid signature');
        return res.status(400).send('Invalid signature');
      }
    }

    const event = req.body;
    console.log('[Webhook] Processing event type:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'payment.paid':
      case 'checkout_session.paid':
        await handleSuccessfulPayment(event);
        break;
      
      case 'payment.failed':
        await handleFailedPayment(event);
        break;
      
      case 'source.chargeable':
        console.log('[Webhook] Source chargeable - creating payment');
        await handleSourceChargeable(event);
        break;
      
      default:
        console.log('[Webhook] Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Handle successful payments
const handleSuccessfulPayment = async (event) => {
  const attributes = event.data.attributes;
  const metadata = attributes.metadata || {};
  const orderId = metadata.orderId;

  if (!orderId) {
    console.error('[Webhook] Missing orderId in metadata');
    throw new Error('Missing orderId');
  }

  console.log('[Webhook] Processing payment for order:', orderId);

  const paymentMethod = attributes.payment_method_type || 
                       (attributes.source?.type === 'gcash' ? 'GCash' : 
                        attributes.source?.type === 'grab_pay' ? 'GrabPay' : 'Card');

  const updateData = {
    payment: true,
    paymentStatus: "paid",
    status: "Order Placed",
    paymentMethod: paymentMethod,
    $push: {
      statusHistory: {
        status: "Payment Completed",
        notes: `Processed via ${event.type} webhook`,
        date: new Date()
      }
    }
  };

  const updatedOrder = await orderModel.findByIdAndUpdate(
    orderId,
    updateData,
    { new: true }
  );

  if (!updatedOrder) {
    console.warn('[Webhook] Order not found for ID:', orderId);
    return;
  }

  // Deduct stock
  try {
    for (const item of updatedOrder.items) {
      const product = await productModel.findById(item.productId);
      if (!product) continue;

      // Handle variations if they exist
      if (item.variationId && product.variations?.length > 0) {
        for (const variation of product.variations) {
          const option = variation.options?.find(
            opt => opt._id.toString() === item.variationId.toString()
          );
          if (option) {
            option.quantity = Math.max(0, option.quantity - item.quantity);
            await product.save();
            break;
          }
        }
      } else {
        // Default stock handling
        product.stock = Math.max(0, product.stock - item.quantity);
        await product.save();
      }
    }
    console.log('[Webhook] Stock updated successfully');
  } catch (stockError) {
    console.error('[Webhook] Error updating stock:', stockError);
  }
};

// Handle source chargeable event
const handleSourceChargeable = async (event) => {
  try {
    const sourceData = event.data.attributes;
    const metadata = sourceData.metadata || {};
    const orderId = metadata.orderId;
    const sourceId = event.data.id;

    if (!orderId) {
      console.error('[Webhook] Missing orderId in source metadata');
      return;
    }

    console.log('[Webhook] Creating payment from chargeable source:', sourceId);

    // Create payment from the chargeable source
    const paymentResponse = await axios.post(
      'https://api.paymongo.com/v1/payments',
      {
        data: {
          attributes: {
            amount: sourceData.amount,
            currency: sourceData.currency,
            source: {
              id: sourceId,
              type: 'source'
            },
            description: `Payment for Order #${metadata.orderNumber || orderId}`
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

    console.log('[Webhook] Payment created from source:', paymentResponse.data.data.id);
    console.log('[Webhook] Payment status:', paymentResponse.data.data.attributes.status);

    // If payment is successful, update the order
    if (paymentResponse.data.data.attributes.status === 'paid') {
      await handleSuccessfulPayment({
        type: 'payment.paid',
        data: {
          attributes: {
            ...paymentResponse.data.data.attributes,
            metadata: metadata
          }
        }
      });
    }

  } catch (error) {
    console.error('[Webhook] Error creating payment from source:', error.response?.data || error.message);
  }
};

// Handle failed payments
const handleFailedPayment = async (event) => {
  const orderId = event.data.attributes.metadata?.orderId;
  if (!orderId) return;

  await orderModel.findByIdAndUpdate(orderId, {
    payment: false,
    paymentStatus: "failed",
    status: "Payment Failed",
    $push: {
      statusHistory: {
        status: "Payment Failed",
        notes: `Failed via webhook: ${event.type}`,
        date: new Date()
      }
    }
  });
  console.log(`[Webhook] Marked order ${orderId} as failed`);
};

// Verify webhook signature
const verifyWebhookSignature = (payload, signature) => {
  if (process.env.NODE_ENV !== 'production') {
    return true; // Skip in non-production for testing
  }

  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Webhook] Missing webhook secret');
    return false;
  }

  const hmac = crypto.createHmac('sha256', webhookSecret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return signature === digest;
};

// Create Paymongo payment
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
        paymentUrl: sourceResponse.data.data.attributes.redirect.checkout_url,
        orderId: order._id,
        orderNumber: order.orderNumber,
        sourceId: sourceResponse.data.data.id,
        redirect: true
      });
    }

    // Card payments
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

// Verify payment status
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, payment_intent_id, source_id, status } = req.query;
    
    // Validate required parameters
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Missing orderId"
      });
    }

    // Find the existing order
    const existingOrder = await orderModel.findById(orderId);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Handle failed payments
    if (status === 'failed') {
      await orderModel.findByIdAndUpdate(orderId, {
        payment: false,
        paymentStatus: "failed",
        status: "Payment Failed",
        $push: {
          statusHistory: {
            status: "Payment Failed",
            notes: "User was redirected back from payment gateway with failed status",
            date: new Date()
          }
        }
      });
      
      return res.json({
        success: false,
        message: "Payment was cancelled or failed. You can retry the payment.",
        redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentFailed=true&orderId=${orderId}`
      });
    }

    // Handle successful payments from GCash/GrabPay (source_id exists)
    if (source_id) {
      try {
        // Verify the source payment status
        const sourceResponse = await axios.get(
          `https://api.paymongo.com/v1/sources/${source_id}`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString("base64")}`,
            },
          }
        );

        const sourceStatus = sourceResponse.data.data.attributes.status;
        const paymentMethod = sourceResponse.data.data.attributes.type === 'gcash' ? 'GCash' : 'GrabPay';

        if (sourceStatus === 'consumed' || sourceStatus === 'paid') {
          // Check if payment was already processed by webhook
          const updatedOrder = await orderModel.findByIdAndUpdate(
            orderId,
            {
              payment: true,
              paymentStatus: "paid",
              status: "Order Placed",
              paymentMethod: paymentMethod,
              $push: {
                statusHistory: {
                  status: "Payment Verified",
                  notes: `Payment verified via source (${sourceStatus})`,
                  date: new Date()
                }
              }
            },
            { new: true }
          );

          // Deduct stock
          for (const item of updatedOrder.items) {
            await productModel.findByIdAndUpdate(item.productId, {
              $inc: { stock: -item.quantity }
            });
          }

          return res.json({
            success: true,
            message: "Payment successful",
            redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentSuccess=true&orderId=${orderId}`
          });
        } else if (sourceStatus === 'chargeable') {
          // Source is chargeable, create payment
          console.log('[Verify] Source is chargeable, creating payment...');
          
          try {
            const paymentResponse = await axios.post(
              'https://api.paymongo.com/v1/payments',
              {
                data: {
                  attributes: {
                    amount: sourceResponse.data.data.attributes.amount,
                    currency: sourceResponse.data.data.attributes.currency,
                    source: {
                      id: source_id,
                      type: 'source'
                    },
                    description: `Payment for Order #${existingOrder.orderNumber}`
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

            console.log('[Verify] Payment created:', paymentResponse.data.data.id);
            
            if (paymentResponse.data.data.attributes.status === 'paid') {
              // Payment successful, update order
              const updatedOrder = await orderModel.findByIdAndUpdate(
                orderId,
                {
                  payment: true,
                  paymentStatus: "paid",
                  status: "Order Placed",
                  paymentMethod: paymentMethod,
                  $push: {
                    statusHistory: {
                      status: "Payment Completed",
                      notes: "Payment created and completed via verification",
                      date: new Date()
                    }
                  }
                },
                { new: true }
              );

              // Deduct stock
              for (const item of updatedOrder.items) {
                await productModel.findByIdAndUpdate(item.productId, {
                  $inc: { stock: -item.quantity }
                });
              }

              return res.json({
                success: true,
                message: "Payment successful",
                redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentSuccess=true&orderId=${orderId}`
              });
            } else {
              return res.json({
                success: false,
                message: "Payment processing",
                redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentPending=true&orderId=${orderId}`
              });
            }
          } catch (paymentError) {
            console.error('[Verify] Error creating payment:', paymentError.response?.data || paymentError.message);
            return res.json({
              success: false,
              message: "Payment processing failed",
              redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentFailed=true&orderId=${orderId}`
            });
          }
        } else if (sourceStatus === 'pending') {
          // Payment still processing - user needs to complete payment
          return res.json({
            success: false,
            message: "Payment not completed. Please complete the payment on Paymongo's side.",
            redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentPending=true&orderId=${orderId}`,
            paymentUrl: `https://secure-authentication.paymongo.com/sources?id=${source_id}`
          });
        } else {
          // Payment failed
          await orderModel.findByIdAndUpdate(orderId, {
            payment: false,
            paymentStatus: "failed",
            status: "Payment Failed",
            paymentMethod: paymentMethod,
            $push: {
              statusHistory: {
                status: "Payment Failed",
                notes: `Source status: ${sourceStatus}`,
                date: new Date()
              }
            }
          });
          return res.json({
            success: false,
            message: "Payment failed",
            redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentFailed=true&orderId=${orderId}`
          });
        }
      } catch (sourceError) {
        console.error("Source verification error:", sourceError);
        // Fall through to general verification
      }
    }

    // Handle card payments (payment_intent_id exists)
    if (payment_intent_id) {
      try {
        let paymentIntentResponse;
        let paymentStatus;
        let attempts = 0;
        const maxAttempts = 5;
        
        // Poll payment intent status
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

        // Get payment method details
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
          paymentMethod = pmResponse.data.data.attributes.type === 'card' ? 
                         'Credit/Debit Card' : 
                         pmResponse.data.data.attributes.type.charAt(0).toUpperCase() + 
                         pmResponse.data.data.attributes.type.slice(1);
        }

        // Handle payment status
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
              const order = await orderModel.findByIdAndUpdate(orderId, {
                payment: true,
                paymentStatus: "paid",
                status: "Order Placed",
                paymentMethod: paymentMethod,
                $push: {
                  statusHistory: {
                    status: "Payment Verified",
                    notes: "Payment verified via payment intent",
                    date: new Date()
                  }
                }
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
            await orderModel.findByIdAndUpdate(orderId, {
              payment: false,
              paymentStatus: "failed",
              status: "Payment Failed",
              paymentMethod: paymentMethod,
              $push: {
                statusHistory: {
                  status: "Payment Failed",
                  notes: `Payment intent status: ${paymentStatus}`,
                  date: new Date()
                }
              }
            });
            return res.json({
              success: false,
              message: "Payment failed or was cancelled",
              redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentFailed=true&orderId=${orderId}`
            });
        }
      } catch (cardError) {
        console.error("Card payment verification error:", cardError);
        // Fall through to general verification
      }
    }

    // General verification flow (for cases where webhook might have processed it)
    if (status === 'success') {
      // Check if order is already marked as paid
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
      
      // If still pending after waiting
      return res.json({
        success: false,
        message: "Payment verification in progress",
        redirectUrl: `${process.env.FRONTEND_URL}/orders?paymentPending=true&orderId=${orderId}`
      });
    }

    // Default case - verification in progress
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
        $push: {
          statusHistory: {
            status: "Verification Error",
            notes: error.message.substring(0, 200),
            date: new Date()
          }
        }
      });
    }
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.response?.data || error.message
    });
  }
};

// Retry failed payment
export const retryPaymongoPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Recalculate amount
    const subtotal = order.items.reduce((sum, item) => {
      const basePrice = item.finalPrice || item.price || 0;
      return sum + basePrice * item.quantity;
    }, 0);

    const finalAmount = Math.round((subtotal - (order.discountAmount || 0) - (order.voucherAmount || 0) + (order.shippingFee || 0)) * 100) / 100;
    const amountInCentavos = Math.round(finalAmount * 100);

    // Payment method mapping
    const paymentMethodMap = {
      'gcash': 'gcash',
      'grab_pay': 'grab_pay',
      'credit/debit card': 'card',
      'card': 'card'
    };

    const paymentMethod = order.paymentMethod.toLowerCase();
    const sourceType = paymentMethodMap[paymentMethod];

    if (!sourceType) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method: ${order.paymentMethod}`
      });
    }

    // For e-wallets (GCash, GrabPay)
    if (sourceType !== 'card') {
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
              type: sourceType,
              billing: {
                name: `${order.address.firstName} ${order.address.lastName}`,
                email: order.address.email,
                phone: order.address.phone
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
        paymentUrl: sourceResponse.data.data.attributes.redirect.checkout_url,
        orderId: order._id
      });
    }

    // For card payments
    const checkoutSession = await axios.post(
      "https://api.paymongo.com/v1/checkout_sessions",
      {
        data: {
          attributes: {
            billing: {
              name: `${order.address.firstName} ${order.address.lastName}`,
              email: order.address.email,
              phone: order.address.phone
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
      paymentUrl: checkoutSession.data.data.attributes.checkout_url,
      orderId: order._id
    });

  } catch (error) {
    console.error("Retry payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error.response?.data?.errors?.[0]?.detail || error.message
    });
  }
};