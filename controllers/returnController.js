import Return from "../models/returnModel.js";
import orderModel from "../models/orderModel.js";
import productModel from "../models/productModel.js";
import userModel from "../models/userModel.js";
import { io } from '../server.js';
import path from "path";
import fs from "fs";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const checkReturnEligibility = async (req, res) => {
  try {
    const { orderId, itemId } = req.query;

    if (!orderId || !itemId) {
      return res.status(400).json({ message: 'Missing orderId or itemId' });
    }

    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ensure the item exists in the order
    const item = order.items.find(i => i.productId?.toString() === itemId || i._id?.toString() === itemId);

    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }

    // Check if already returned
    if (item.returnStatus && item.returnStatus !== 'none') {
      return res.status(400).json({ message: 'Item has already been returned or is being processed.' });
    }

    // Check order status
    if (order.status !== 'Delivered' && order.status !== 'delivered') {
      return res.status(400).json({ message: 'Item is not eligible for return. Order not delivered yet.' });
    }

    // You can add more rules here (like return within 7 days, etc.)

    res.status(200).json({ eligible: true });
  } catch (error) {
    console.error('Error checking return eligibility:', error);
    res.status(500).json({ message: 'Server error checking return eligibility' });
  }
};

// Create return request
const createReturn = async (req, res) => {
  try {
    const { orderId, itemId, reason, description } = req.body;
    const userId = req.userId;

    // Validate order exists and belongs to user
    const order = await orderModel.findOne({ 
      _id: orderId, 
      userId 
    });
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found or doesn't belong to user" 
      });
    }

    // Check if item exists in order
    const item = order.items.find(item => item._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: "Item not found in order" 
      });
    }

    // Check if return already exists for this item
    const existingReturn = await Return.findOne({ 
      orderId, 
      itemId 
    });
    
    if (existingReturn) {
      return res.status(400).json({ 
        success: false, 
        message: "Return already requested for this item" 
      });
    }

    // Check if order is eligible for return (within 7 days of delivery)
    const deliveryDate = new Date(order.updatedAt);
    const returnDeadline = new Date(deliveryDate);
    returnDeadline.setDate(returnDeadline.getDate() + 7);
    
    if (new Date() > returnDeadline) {
      return res.status(400).json({ 
        success: false, 
        message: "Return window has expired (7 days from delivery)" 
      });
    }

    // Create return
    const newReturn = new Return({
      orderId,
      userId,
      itemId,
      reason,
      description,
      status: 'pending',
      refundAmount: item.price * item.quantity,
      statusHistory: [{
        status: 'pending',
        notes: 'Return request submitted'
      }]
    });

    await newReturn.save();

    // Update order item with return status
    const itemIndex = order.items.findIndex(i => i._id.toString() === itemId);
    order.items[itemIndex].returnStatus = 'pending';
    await order.save();

    // Notify admin via WebSocket
    io.to('admin_room').emit('newReturnRequest', newReturn);

    res.status(201).json({ 
      success: true, 
      message: "Return request submitted successfully",
      return: newReturn
    });

  } catch (error) {
    console.error("Error creating return:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create return request" 
    });
  }
};

// Process return (admin only)
const processReturn = async (req, res) => {
  try {
    const { returnId, action, notes, refundAmount, refundMethod } = req.body;
    const adminId = req.userId;

    const returnRequest = await Return.findById(returnId);
    if (!returnRequest) {
      return res.status(404).json({ 
        success: false, 
        message: "Return request not found" 
      });
    }

    // Get order and item
    const order = await orderModel.findById(returnRequest.orderId);
    const item = order.items.find(i => i._id.toString() === returnRequest.itemId);

    switch (action) {
      case 'approve':
        // Validate refund amount
        const maxRefund = item.price * item.quantity;
        if (refundAmount > maxRefund) {
          return res.status(400).json({ 
            success: false, 
            message: `Refund amount cannot exceed original price (₱${maxRefund})` 
          });
        }

        returnRequest.status = 'approved';
        returnRequest.refundAmount = refundAmount || maxRefund;
        returnRequest.refundMethod = refundMethod || 'original_payment';
        returnRequest.adminNotes = notes;

        // Update order item status
        const itemIndex = order.items.findIndex(i => i._id.toString() === returnRequest.itemId);
        order.items[itemIndex].returnStatus = 'approved';
        await order.save();

        // Restock product if needed
        if (item.variationId) {
          const product = await productModel.findById(item.productId);
          const variation = product.variations.find(v => 
            v.options.some(o => o._id.toString() === item.variationId)
          );
          if (variation) {
            const option = variation.options.find(o => o._id.toString() === item.variationId);
            option.quantity += item.quantity;
            await product.save();
          }
        } else {
          await productModel.findByIdAndUpdate(
            item.productId,
            { $inc: { quantity: item.quantity } }
          );
        }

        break;

      case 'reject':
        returnRequest.status = 'rejected';
        returnRequest.adminNotes = notes;
        
        // Update order item status
        const rejectItemIndex = order.items.findIndex(i => i._id.toString() === returnRequest.itemId);
        order.items[rejectItemIndex].returnStatus = 'rejected';
        await order.save();
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          message: "Invalid action" 
        });
    }

    // Add status history
    returnRequest.statusHistory.push({
      status: returnRequest.status,
      notes: notes || `Return ${action}d by admin`,
      changedBy: adminId
    });

    await returnRequest.save();

    // Notify user via WebSocket
    io.to(returnRequest.userId.toString()).emit('returnStatusUpdate', returnRequest);

    res.json({ 
      success: true, 
      message: `Return request ${action}d successfully`,
      return: returnRequest
    });

  } catch (error) {
    console.error("Error processing return:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to process return" 
    });
  }
};

// Process refund
const processRefund = async (req, res) => {
  try {
    const { returnId } = req.body;
    const adminId = req.userId;

    const returnRequest = await Return.findById(returnId);
    if (!returnRequest) {
      return res.status(404).json({ 
        success: false, 
        message: "Return request not found" 
      });
    }

    if (returnRequest.status !== 'approved') {
      return res.status(400).json({ 
        success: false, 
        message: "Return must be approved before processing refund" 
      });
    }

    // Get order
    const order = await orderModel.findById(returnRequest.orderId);

    // Process refund based on payment method
    switch (order.paymentMethod.toLowerCase()) {
      case 'stripe':
        try {
          // Create Stripe refund
          const refund = await stripe.refunds.create({
            payment_intent: order.stripePaymentId, // You'll need to store this when creating the order
            amount: Math.round(returnRequest.refundAmount * 100) // Convert to cents
          });

          returnRequest.status = 'refunded';
          returnRequest.statusHistory.push({
            status: 'refunded',
            notes: `Refund processed via Stripe (${refund.id})`,
            changedBy: adminId
          });
          break;

        } catch (stripeError) {
          console.error("Stripe refund error:", stripeError);
          return res.status(500).json({ 
            success: false, 
            message: "Failed to process Stripe refund" 
          });
        }

      case 'gcash':
        // For GCash, you would typically record the transaction ID manually
        returnRequest.status = 'refunded';
        returnRequest.statusHistory.push({
          status: 'refunded',
          notes: "Refund processed via GCash (manual)",
          changedBy: adminId
        });
        break;

      case 'cod':
      case 'receipt_upload':
        // For COD or receipt upload, refund would typically be via bank transfer or store credit
        returnRequest.status = 'refunded';
        returnRequest.statusHistory.push({
          status: 'refunded',
          notes: "Refund processed via " + returnRequest.refundMethod,
          changedBy: adminId
        });
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          message: "Unsupported payment method for automatic refund" 
        });
    }

    await returnRequest.save();

    // Update order item status
    const itemIndex = order.items.findIndex(i => i._id.toString() === returnRequest.itemId);
    order.items[itemIndex].returnStatus = 'refunded';
    await order.save();

    // Notify user via WebSocket
    io.to(returnRequest.userId.toString()).emit('returnStatusUpdate', returnRequest);

    res.json({ 
      success: true, 
      message: "Refund processed successfully",
      return: returnRequest
    });

  } catch (error) {
    console.error("Error processing refund:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to process refund" 
    });
  }
};

// Get user's returns
const getUserReturns = async (req, res) => {
  try {
    const userId = req.userId;
    const returns = await Return.find({ userId })
      .populate('orderId', 'orderNumber date amount')
      .sort({ createdAt: -1 });

    res.json({ 
      success: true, 
      returns 
    });

  } catch (error) {
    console.error("Error fetching user returns:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch return requests" 
    });
  }
};

// Get return details
const getReturnDetails = async (req, res) => {
  try {
    const returnId = req.params.id;
    const userId = req.userId;

    const returnRequest = await Return.findOne({ 
      _id: returnId,
      userId 
    }).populate('orderId');

    if (!returnRequest) {
      return res.status(404).json({ 
        success: false, 
        message: "Return request not found" 
      });
    }

    res.json({ 
      success: true, 
      return: returnRequest 
    });

  } catch (error) {
    console.error("Error fetching return details:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch return details" 
    });
  }
};

// Upload return evidence
const uploadReturnEvidence = async (req, res) => {
  try {
    const { returnId } = req.params;
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No file uploaded" 
      });
    }

    const returnRequest = await Return.findOne({ 
      _id: returnId,
      userId 
    });

    if (!returnRequest) {
      return res.status(404).json({ 
        success: false, 
        message: "Return request not found" 
      });
    }

    if (returnRequest.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot add evidence to a processed return" 
      });
    }

    // Add image to return
    returnRequest.images.push({
      filename: req.file.filename,
      path: req.file.path,
      mimetype: req.file.mimetype
    });

    await returnRequest.save();

    res.json({ 
      success: true, 
      message: "Evidence uploaded successfully",
      return: returnRequest
    });

  } catch (error) {
    console.error("Error uploading return evidence:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to upload evidence" 
    });
  }
};

export {
  createReturn,
  processReturn,
  processRefund,
  getUserReturns,
  getReturnDetails,
  uploadReturnEvidence
};