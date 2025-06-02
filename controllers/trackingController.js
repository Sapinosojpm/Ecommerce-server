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
     const orderId = req.params.id; // <-- Get from params
    const { trackingNumber, carrierCode } = req.body;

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

    // Validate carrier code
    const validCarriers = await getValidCarriers();
    if (!validCarriers.some(c => c.code === carrierCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid carrier code'
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
      customer_phone: order.address?.phone || '',
      note: `Order from ${process.env.APP_NAME || 'E-commerce Store'}`
    };

    const response = await trackingApi.post('/trackings/create', {
      data: {
        attributes: trackingData
      }
    });

    // Update order with tracking info
    order.tracking = {
      trackingNumber,
      carrierCode,
      trackingId: response.data.data.id,
      trackingUrl: `https://trackingmore.com/tracking.php?nums=${trackingNumber}&courier=${carrierCode}`,
      status: 'pending',
      lastUpdated: new Date()
    };

    // Update order status to "Shipped" when tracking is added
    order.status = 'Shipped';
    order.statusHistory.push({
      status: 'Shipped',
      changedAt: new Date(),
      notes: 'Tracking information added'
    });

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
      message: 'Tracking created successfully',
      tracking: order.tracking
    });

  } catch (error) {
    console.error('Error creating tracking:', {
      error: error.response?.data || error.message,
      stack: error.stack
    });
    
    let errorMessage = 'Failed to create tracking';
    if (error.response?.data?.errors) {
      errorMessage = error.response.data.errors.map(e => e.message).join(', ');
    }

    return res.status(500).json({
      success: false,
      message: errorMessage,
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
    const response = await trackingApi.get(
      `/trackings/${order.tracking.trackingNumber}/${order.tracking.carrierCode}`
    );

    const trackingData = response.data.data;
    
    // Update local tracking info if needed
    if (trackingData.status !== order.tracking.status) {
      order.tracking.status = trackingData.status;
      order.tracking.events = trackingData.events;
      order.tracking.lastUpdated = new Date();
      
      // Update order status based on tracking status
      updateOrderStatusFromTracking(order, trackingData.status);
      
      await order.save();
    }

    return res.json({
      success: true,
      tracking: {
        ...order.tracking.toObject(),
        details: trackingData
      }
    });

  } catch (error) {
    console.error('Error getting tracking:', {
      error: error.response?.data || error.message,
      stack: error.stack
    });
    
    // If API fails, try to return local tracking info
    const order = await orderModel.findById(req.params.orderId);
    if (order?.tracking) {
      return res.json({
        success: true,
        tracking: order.tracking,
        warning: 'Could not fetch latest tracking info'
      });
    }

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
    // Verify webhook signature if needed
    // const signature = req.headers['trackingmore-webhook-signature'];
    // if (!verifyWebhookSignature(signature, req.body)) {
    //   return res.status(401).json({ success: false, message: 'Unauthorized' });
    // }

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
    updateOrderStatusFromTracking(order, status);

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
    console.error('Error updating tracking:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to update tracking'
    });
  }
};

// Get all carriers supported by TrackingMore
export const getCarriers = async (req, res) => {
  try {
    const carriers = await getValidCarriers();
    return res.json({
      success: true,
      carriers
    });
  } catch (error) {
    console.error('Error getting carriers:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to get carriers list'
    });
  }
};

async function getValidCarriers() {
  try {
    const response = await trackingApi.get('/carriers');
    console.log('Raw carriers response:', response.data);  // Debug line

    if (!response.data.success) {
      console.error('API returned success=false');
      return [];
    }

    if (!response.data.data || response.data.data.length === 0) {
      console.warn('No carriers returned from API');
      return [];
    }

    return response.data.data.map(carrier => ({
      code: carrier.code,
      name: carrier.name,
      website: carrier.website
    }));
  } catch (error) {
    console.error('Error fetching carriers:', error);
    return [];
  }
}



function updateOrderStatusFromTracking(order, trackingStatus) {
  const statusMap = {
    'pending': 'Shipped',
    'in_transit': 'Shipped',
    'out_for_delivery': 'Out for Delivery',
    'delivered': 'Delivered',
    'exception': 'Delivery Exception',
    'expired': 'Delivery Failed'
  };

  const newStatus = statusMap[trackingStatus] || order.status;
  if (newStatus !== order.status) {
    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      notes: `Status updated from tracking: ${trackingStatus}`
    });
  }
}

// Optional: Webhook signature verification
function verifyWebhookSignature(signature, body) {
  // Implement your verification logic here if needed
  return true; // Placeholder
}