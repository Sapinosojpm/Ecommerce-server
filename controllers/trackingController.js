import axios from 'axios';
import orderModel from '../models/orderModel.js';
import dotenv from 'dotenv';

dotenv.config();

const TRACKINGMORE_API_KEY = process.env.TRACKINGMORE_API_KEY;
const TRACKINGMORE_BASE_URL = 'https://api.trackingmore.com/v4';

// Configure axios instance for TrackingMore API
const trackingApi = axios.create({
  baseURL: TRACKINGMORE_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Tracking-Api-Key': TRACKINGMORE_API_KEY
  }
});

// Create a tracking number
export const createTracking = async (req, res) => {
  try {
    const { orderId, trackingNumber, carrierCode } = req.body;

    if (!orderId || !trackingNumber || !carrierCode) {
      return res.status(400).json({
        success: false,
        message: 'Order ID, tracking number and carrier code are required'
      });
    }

    // First check if order exists
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Create tracking in TrackingMore
    const trackingData = {
      tracking_number: trackingNumber,
      carrier_code: carrierCode,
      order_id: order.orderNumber || orderId,
      order_date: order.createdAt.toISOString().split('T')[0],
      customer_name: `${order.address?.firstName} ${order.address?.lastName}`,
      destination_code: 'PH', // Philippines
      title: `Order ${order.orderNumber}`,
      logistics_channel: order.paymentMethod,
      customer_email: order.address?.email || '',
      customer_phone: order.address?.phone || ''
    };

    const response = await trackingApi.post('/trackings/create', trackingData);

    // Update order with tracking info
    order.tracking = {
      trackingNumber,
      carrierCode,
      trackingId: response.data.data.id,
      trackingUrl: `https://trackingmore.com/tracking.php?nums=${trackingNumber}&courier=${carrierCode}`
    };

    await order.save();

    return res.json({
      success: true,
      message: 'Tracking created successfully',
      tracking: order.tracking
    });

  } catch (error) {
    console.error('Error creating tracking:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create tracking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get tracking info
export const getTracking = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await orderModel.findById(orderId);
    if (!order || !order.tracking) {
      return res.status(404).json({
        success: false,
        message: 'Order or tracking not found'
      });
    }

    // Get tracking info from TrackingMore
    const response = await trackingApi.get(`/trackings/get?tracking_number=${order.tracking.trackingNumber}&carrier_code=${order.tracking.carrierCode}`);

    return res.json({
      success: true,
      tracking: {
        ...order.tracking.toObject(),
        details: response.data.data
      }
    });

  } catch (error) {
    console.error('Error getting tracking:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to get tracking info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update tracking info (webhook handler)
export const updateTracking = async (req, res) => {
  try {
    const { tracking_number, carrier_code, status, original_country, destination_country, events } = req.body;

    // Find order by tracking number
    const order = await orderModel.findOne({ 'tracking.trackingNumber': tracking_number });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found for this tracking'
      });
    }

    // Update tracking info
    order.tracking.status = status;
    order.tracking.events = events;
    order.tracking.lastUpdated = new Date();

    // Update order status based on tracking status
    if (status === 'delivered') {
      order.status = 'delivered';
    } else if (status === 'in_transit') {
      order.status = 'shipped';
    } else if (status === 'out_for_delivery') {
      order.status = 'out for delivery';
    }

    await order.save();

    // Emit WebSocket events
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(order.userId.toString()).emit('orderTrackingUpdate', order);
      io.to('admin_room').emit('orderTrackingUpdateAdmin', order);
      io.to(`order_${order._id.toString()}`).emit('orderStatusUpdate', order);
    }

    return res.json({
      success: true,
      message: 'Tracking updated successfully'
    });

  } catch (error) {
    console.error('Error updating tracking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update tracking'
    });
  }
};

// Get all carriers supported by TrackingMore
export const getCarriers = async (req, res) => {
  try {
    const response = await trackingApi.get('/carriers');
    return res.json({
      success: true,
      carriers: response.data.data
    });
  } catch (error) {
    console.error('Error getting carriers:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to get carriers list'
    });
  }
};