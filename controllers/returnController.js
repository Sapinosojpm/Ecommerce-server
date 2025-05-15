// returnController.js
import Order from '../models/orderModel.js';
import Return from '../models/returnModel.js';
import User from '../models/userModel.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/returns');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `return-${uniqueSuffix}${extension}`);
  }
});

export const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Check if an item is eligible for return
export const checkReturnEligibility = async (req, res) => {
  try {
    const { orderId, itemId } = req.query;
    const userId = req.user.id;

    // Find the order
    const order = await Order.findOne({ _id: orderId, userId });
    
    if (!order) {
      return res.status(404).json({ eligible: false, message: 'Order not found' });
    }

    // Check if the order status is "Delivered" (with capital D)
    if (order.status !== 'Delivered') {
      return res.status(400).json({ 
        eligible: false, 
        message: 'Only delivered orders are eligible for return' 
      });
    }

    // Find the specific item in the order
    const item = order.items.find(item => item._id.toString() === itemId);
    
    if (!item) {
      return res.status(404).json({ eligible: false, message: 'Item not found in order' });
    }

    // Check if the item already has a return request
    if (item.returnStatus && item.returnStatus !== 'none') {
      return res.status(400).json({ 
        eligible: false, 
        message: `A return request for this item is already ${item.returnStatus}` 
      });
    }

    // Check if the return window is still open (e.g., 30 days)
    const deliveryDate = order.statusHistory.find(history => history.status === 'Delivered')?.changedAt || order.updatedAt;
    const returnWindow = 30; // 30 days
    const returnDeadline = new Date(deliveryDate);
    returnDeadline.setDate(returnDeadline.getDate() + returnWindow);
    
    if (new Date() > returnDeadline) {
      return res.status(400).json({ 
        eligible: false, 
        message: `Return window of ${returnWindow} days has expired` 
      });
    }

    // The item is eligible for return
    const orderDetails = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      itemDetails: {
        id: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image
      }
    };

    return res.status(200).json({ eligible: true, orderDetails });
    
  } catch (error) {
    console.error('Error checking return eligibility:', error);
    return res.status(500).json({ 
      eligible: false, 
      message: 'Failed to check return eligibility' 
    });
  }
};

// Create a new return request
export const createReturn = async (req, res) => {
  try {
    const { orderId, itemId, reason, description } = req.body;
    const userId = req.user.id;

    // Find the order
    const order = await Order.findOne({ _id: orderId, userId });
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if the order status is "Delivered" (with capital D)
    if (order.status !== 'Delivered') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only delivered orders are eligible for return' 
      });
    }

    // Find the specific item in the order
    const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    // Check if the item already has a return request
    if (order.items[itemIndex].returnStatus && order.items[itemIndex].returnStatus !== 'none') {
      return res.status(400).json({ 
        success: false, 
        message: `A return request for this item is already ${order.items[itemIndex].returnStatus}` 
      });
    }

    // Create the return request
    const newReturn = new Return({
      orderId,
      userId,
      itemId,
      reason,
      description,
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          notes: 'Return request submitted',
          changedBy: userId
        }
      ]
    });

    // Update the item's return status in the order
    order.items[itemIndex].returnStatus = 'pending';
    
    // Save both documents
    await newReturn.save();
    await order.save();

    return res.status(201).json({ 
      success: true, 
      message: 'Return request created successfully',
      return: newReturn
    });
    
  } catch (error) {
    console.error('Error in createReturn:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create return request',
      error: error.message
    });
  }
};

// Upload evidence for a return request
export const uploadEvidence = async (req, res) => {
  try {
    const { returnId } = req.params;
    const userId = req.user.id;

    // Find the return request
    const returnRequest = await Return.findOne({ _id: returnId, userId });
    
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    // Check if the status allows uploading evidence
    if (returnRequest.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot upload evidence for a return in ${returnRequest.status} status` 
      });
    }

    // Process uploaded files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    // Add the images to the return request
    const images = req.files.map(file => ({
      filename: file.filename,
      path: file.path,
      mimetype: file.mimetype
    }));

    returnRequest.images = returnRequest.images ? [...returnRequest.images, ...images] : images;
    
    // Save the return request
    await returnRequest.save();

    return res.status(200).json({ 
      success: true, 
      message: 'Evidence uploaded successfully',
      images: returnRequest.images
    });
    
  } catch (error) {
    console.error('Error uploading evidence:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to upload evidence',
      error: error.message
    });
  }
};

// Get all returns for a user
export const getUserReturns = async (req, res) => {
  try {
    const userId = req.user.id;

    const returns = await Return.find({ userId })
      .populate('orderId', 'orderNumber date')
      .sort({ createdAt: -1 });

    return res.status(200).json({ returns });
    
  } catch (error) {
    console.error('Error getting user returns:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch return requests',
      error: error.message
    });
  }
};

// Get details of a specific return
export const getReturnDetails = async (req, res) => {
  try {
    const { returnId } = req.params;
    const userId = req.user.id;

    const returnRequest = await Return.findOne({ _id: returnId, userId })
      .populate('orderId', 'orderNumber date items status');

    if (!returnRequest) {
      return res.status(404).json({ message: 'Return request not found' });
    }

    // Get the specific item from the order
    const order = returnRequest.orderId;
    const item = order.items.find(item => item._id.toString() === returnRequest.itemId.toString());

    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }

    // Construct response with all necessary details
    const response = {
      returnId: returnRequest._id,
      orderId: order._id,
      orderNumber: order.orderNumber,
      orderDate: order.date,
      itemDetails: {
        id: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image
      },
      reason: returnRequest.reason,
      description: returnRequest.description,
      images: returnRequest.images,
      status: returnRequest.status,
      statusHistory: returnRequest.statusHistory,
      createdAt: returnRequest.createdAt,
      updatedAt: returnRequest.updatedAt
    };

    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Error getting return details:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch return details',
      error: error.message
    });
  }
};

// Admin: Get all returns
export const getAllReturns = async (req, res) => {
  try {
    const { status, sort = 'newest', page = 1, limit = 10 } = req.query;
    const query = {};
    
    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Determine sort order
    let sortOption = {};
    if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get returns with pagination
    const returns = await Return.find(query)
      .populate('userId', 'name email')
      .populate('orderId', 'orderNumber date')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));
      
    // Get total count for pagination
    const totalReturns = await Return.countDocuments(query);
    
    return res.status(200).json({ 
      returns,
      pagination: {
        total: totalReturns,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(totalReturns / limit)
      }
    });
    
  } catch (error) {
    console.error('Error getting all returns:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch return requests',
      error: error.message
    });
  }
};

// Admin: Update return status
export const updateReturnStatus = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { status, adminNotes, refundAmount, refundMethod } = req.body;
    const adminId = req.user.id;

    // Find the return request
    const returnRequest = await Return.findById(returnId);
    
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    // Update return request
    returnRequest.status = status;
    if (adminNotes) returnRequest.adminNotes = adminNotes;
    
    if (refundAmount) returnRequest.refundAmount = refundAmount;
    if (refundMethod) returnRequest.refundMethod = refundMethod;
    
    // Add to status history
    returnRequest.statusHistory.push({
      status,
      notes: adminNotes || `Status updated to ${status}`,
      changedBy: adminId
    });

    // Find the order and update the item's return status
    const order = await Order.findById(returnRequest.orderId);
    if (order) {
      const itemIndex = order.items.findIndex(item => 
        item._id.toString() === returnRequest.itemId.toString()
      );
      
      if (itemIndex !== -1) {
        // Update the return status in the order item
        order.items[itemIndex].returnStatus = status;
        await order.save();
      }
    }

    // Save the return request
    await returnRequest.save();

    return res.status(200).json({ 
      success: true, 
      message: 'Return status updated successfully',
      return: returnRequest
    });
    
  } catch (error) {
    console.error('Error updating return status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update return status',
      error: error.message
    });
  }
};