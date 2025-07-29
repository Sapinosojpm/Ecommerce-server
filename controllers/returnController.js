import mongoose from "mongoose"; 
import Return from "../models/returnModel.js";
import orderModel from "../models/orderModel.js";
import productModel from "../models/productModel.js";
import userModel from "../models/userModel.js";
import { io } from '../server.js';
import path from "path";
import fs from "fs";


export const checkReturnEligibility = async (req, res) => {
  try {
    const { orderId, itemId } = req.query;

    if (!orderId || !itemId) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing orderId or itemId' 
      });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    const item = order.items.find(i => 
      i._id?.toString() === itemId || i.productId?.toString() === itemId
    );
    
    if (!item) {
      return res.status(404).json({ 
        success: false,
        message: 'Item not found in order' 
      });
    }

    if (item.returnStatus && item.returnStatus !== 'none') {
      return res.status(400).json({ 
        success: false,
        message: 'Item has already been returned or is being processed.' 
      });
    }

    if (order.status.toLowerCase() !== 'delivered') {
      return res.status(400).json({ 
        success: false,
        message: 'Item is not eligible for return. Order not delivered yet.' 
      });
    }

    // Check return window (7 days from delivery)
    const deliveryDate = order.updatedAt || order.createdAt;
    const returnDeadline = new Date(deliveryDate);
    returnDeadline.setDate(returnDeadline.getDate() + 7);
    
    if (new Date() > returnDeadline) {
      return res.status(400).json({ 
        success: false,
        message: 'Return window expired (7 days from delivery)' 
      });
    }

    res.status(200).json({ 
      success: true,
      eligible: true,
      orderDetails: {
        items: order.items,
        orderDate: order.createdAt,
        status: order.status,
        itemDetails: item 
      }
    });
  } catch (error) {
    console.error('Error checking return eligibility:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error checking return eligibility' 
    });
  }
};


// Create return request
export const createReturn = async (req, res) => {
  try {
    const { orderId, itemId, reason, description } = req.body;
    const userId = req.userId || req.body.userId;

    // Validation
    if (!orderId || !itemId || !reason || !description) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Find order, validate ownership
    const order = await orderModel.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found or not owned by user" });
    }

    // Find item in order
    const item = order.items.find(i => i._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in order" });
    }

    // Prevent duplicate return
    const existingReturn = await Return.findOne({ orderId, itemId });
    if (existingReturn) {
      return res.status(400).json({ success: false, message: "Return already requested for this item" });
    }

    // Check return window (7 days from delivery)
    const deliveryDate = new Date(order.updatedAt);
    const returnDeadline = new Date(deliveryDate);
    returnDeadline.setDate(returnDeadline.getDate() + 7);
    if (new Date() > returnDeadline) {
      return res.status(400).json({ success: false, message: "Return window expired (7 days from delivery)" });
    }

    // Handle file upload (optional, uses multer)
    const images = req.files?.map(file => ({
      filename: file.filename,
      path: file.path,
      mimetype: file.mimetype
    })) || [];

    // Create return record
    const newReturn = new Return({
      orderId,
      userId,
      itemId,
      reason,
      description,
      images,
      status: 'pending',
      refundAmount: item.price * item.quantity,
      refundMethod: 'none',
      statusHistory: [{
        status: 'pending',
        notes: 'Return request submitted',
        changedBy: userId
      }]
    });

    await newReturn.save();

    // Update item's return status
    const itemIndex = order.items.findIndex(i => i._id.toString() === itemId);
    if (itemIndex !== -1) {
      order.items[itemIndex].returnStatus = 'pending';
      await order.save();
    }

    // 🔔 Emit real-time event to admin
    io.to('admin_room').emit('newReturnRequest', newReturn);

    // ✅ Send response
    res.status(201).json({
      success: true,
      message: "Return request submitted successfully",
      return: newReturn
    });

  } catch (error) {
    console.error("Error in createReturn:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// Process return (admin only)
export const processReturn = async (req, res) => {
  try {
    const { returnId, action, notes, refundAmount, refundMethod } = req.body;
    const adminId = req.userId;

    const returnRequest = await Return.findById(returnId);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Return request not found" });
    }

    const order = await orderModel.findById(returnRequest.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items.find(i =>
      i._id.toString() === returnRequest.itemId.toString()
    );

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in order" });
    }

    switch (action) {
      case 'approve':
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

        const itemIndex = order.items.findIndex(i => i._id.toString() === returnRequest.itemId.toString());
        if (itemIndex !== -1) {
          order.items[itemIndex].returnStatus = 'approved';
          await order.save();
        }

        if (item.variationId) {
          const product = await productModel.findById(item.productId);
          if (product) {
            const variation = product.variations.find(v =>
              v.options.some(o => o._id.toString() === item.variationId.toString())
            );
            if (variation) {
              const option = variation.options.find(o => o._id.toString() === item.variationId.toString());
              if (option) {
                option.quantity += item.quantity;
                await product.save();
              }
            }
          }
        } else {
          await productModel.findByIdAndUpdate(item.productId, {
            $inc: { quantity: item.quantity }
          });
        }
        break;

      case 'reject':
        returnRequest.status = 'rejected';
        returnRequest.adminNotes = notes;

        const rejectIndex = order.items.findIndex(i => i._id.toString() === returnRequest.itemId.toString());
        if (rejectIndex !== -1) {
          order.items[rejectIndex].returnStatus = 'rejected';
          await order.save();
        }
        break;

      default:
        return res.status(400).json({ success: false, message: "Invalid action" });
    }

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
    res.status(500).json({ success: false, message: "Failed to process return" });
  }
};

// Process refund
export const processRefund = async (req, res) => {
  try {
    const returnId = req.params.id || req.body.returnId; // <- changed here
    const adminId = req.userId;

    const returnRequest = await Return.findById(returnId);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Return request not found" });
    }

    if (returnRequest.status !== 'approved' && action === 'approve') {
      return res.status(400).json({ success: false, message: "Return must be approved before processing refund" });
    }

    const order = await orderModel.findById(returnRequest.orderId);

    switch (order.paymentMethod.toLowerCase()) {
      case 'stripe':
        returnRequest.status = 'refunded';
        returnRequest.statusHistory.push({
          status: 'refunded',
          notes: "Refund processed via Stripe (manual)",
          changedBy: adminId
        });
        break;

      case 'gcash':
        returnRequest.status = 'refunded';
        returnRequest.statusHistory.push({
          status: 'refunded',
          notes: "Refund processed via GCash (manual)",
          changedBy: adminId
        });
        break;

      case 'cod':
      case 'receipt_upload':
        returnRequest.status = 'refunded';
        returnRequest.statusHistory.push({
          status: 'refunded',
          notes: "Refund processed via " + returnRequest.refundMethod,
          changedBy: adminId
        });
        break;

      default:
        return res.status(400).json({ success: false, message: "Unsupported payment method for refund" });
    }

    await returnRequest.save();

    const itemIndex = order.items.findIndex(i => i._id.toString() === returnRequest.itemId);
    if (itemIndex >= 0) {
      order.items[itemIndex].returnStatus = 'refunded';
      await order.save();
    }

    // Ensure io is defined or comment out this line during testing
    if (typeof io !== 'undefined') {
      io.to(returnRequest.userId.toString()).emit('returnStatusUpdate', returnRequest);
    }

    res.json({
      success: true,
      message: "Refund processed successfully",
      return: returnRequest
    });

  } catch (error) {
    console.error("Error processing refund:", error);
    res.status(500).json({ success: false, message: "Failed to process refund" });
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

// Add this to your returnController.js
export const getAdminReturns = async (req, res) => {
  try {
    const { status, dateRange, search } = req.query;

    // Build base query
    let query = Return.find()
      .populate('userId', 'name email')
      .populate({
        path: 'orderId',
        select: 'orderNumber createdAt paymentMethod items'
      })
      .sort({ createdAt: -1 });

    // Status filter
    if (status && status !== 'all') {
      query = query.where('status').equals(status);
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate;

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }

      if (startDate) {
        query = query.where('createdAt').gte(startDate);
      }
    }

    // Search filter (safe check for ObjectId)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const orConditions = [];

      if (mongoose.Types.ObjectId.isValid(search)) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      orConditions.push(
        { 'orderId.orderNumber': { $regex: searchRegex } },
        { 'userId.name': { $regex: searchRegex } },
        { 'userId.email': { $regex: searchRegex } }
      );

      query = query.or(orConditions);
    }

    const returns = await query.exec();

    res.json({
      success: true,
      returns: returns.map(ret => ({
        ...ret.toObject(),
        itemDetails: ret.orderId?.items?.find(item =>
          item._id?.toString() === ret.itemId?.toString() ||
          item.productId?.toString() === ret.itemId?.toString()
        )
      }))
    });
  } catch (error) {
    console.error('Error fetching admin returns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch return details',
      error: error.message // optional: for debugging
    });
  }
};


// Check if return exists for an item
export const checkReturnExists = async (req, res) => {
  try {
    const { orderId, itemId } = req.query;

    if (!orderId || !itemId) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing orderId or itemId' 
      });
    }

    // Validate IDs are valid MongoDB ObjectIDs
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid orderId or itemId format'
      });
    }

    // Look for an existing return request
    const returnRequest = await Return.findOne({ 
      orderId, 
      itemId 
    }).populate('orderId', 'orderNumber createdAt items');

    if (!returnRequest) {
      return res.status(200).json({ 
        success: true,
        exists: false
      });
    }

    // Return exists
    res.status(200).json({ 
      success: true,
      exists: true,
      returnRequest
    });
  } catch (error) {
    console.error('Error checking return existence:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error checking return status'
    });
  }
};

export {
  getUserReturns,
  getReturnDetails,
  uploadReturnEvidence
};