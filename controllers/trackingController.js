import axios from 'axios';
import orderModel from '../models/orderModel.js';
import { io } from '../server.js';

const API_KEY = process.env.TRACKINGMORE_API_KEY || 'gtx1kms9-0d9t-rjqk-jlzu-r3rllql6k2hx';

// Helper function to map tracking status to order status
const mapStatus = (trackingStatus) => {
  const statusMap = {
    pending: 'Order Placed',
    notfound: 'Order Placed',
    transit: 'Shipped',
    pickup: 'Packing',
    delivered: 'Delivered',
    undelivered: 'Out for Delivery',
    exception: 'Problem/Delayed',
    expired: 'Canceled'
  };
  return statusMap[trackingStatus.toLowerCase()] || 'Order Placed';
};

// Add tracking to order
// Add tracking to order
export const addTracking = async (req, res) => {
  const { orderId } = req.params;
  const { trackingNumber, carrierCode } = req.body;

  // 🐛 DEBUG: Log all incoming data
  console.log('=== DEBUG: addTracking function called ===');
  console.log('📋 Request params:', req.params);
  console.log('📦 Order ID from params:', orderId);
  console.log('📄 Request body:', req.body);
  console.log('🚚 Tracking Number:', trackingNumber);
  console.log('🏢 Carrier Code:', carrierCode);
  console.log('🔗 Full URL:', req.originalUrl);
  console.log('📍 Route path:', req.route?.path);
  console.log('=======================================');

  try {
    // 🛑 Validate input
    if (!trackingNumber || !carrierCode) {
      console.log('❌ Validation failed: Missing tracking number or carrier code');
      return res.status(400).json({ 
        success: false, 
        message: 'Tracking number and carrier code are required' 
      });
    }

    // 🔍 Check if order exists before update
    console.log('🔍 Looking for order with ID:', orderId);
    const existingOrder = await orderModel.findById(orderId);
    
    if (!existingOrder) {
      console.log('❌ Order not found with ID:', orderId);
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    console.log('✅ Order found:', {
      id: existingOrder._id,
      orderNumber: existingOrder.orderNumber,
      status: existingOrder.status,
      currentTracking: existingOrder.tracking // Log current tracking data
    });

    // 🚀 Create tracking in TrackingMore
    console.log('🚀 Creating tracking in TrackingMore with:', {
      tracking_number: trackingNumber,
      courier_code: carrierCode,
      order_id: orderId
    });

    const trackingMoreResponse = await axios.post(
      'https://api.trackingmore.com/v4/trackings/create',
      {
        tracking_number: trackingNumber,
        courier_code: carrierCode,
        order_number: orderId
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Tracking-Api-Key': API_KEY
        }
      }
    );

    console.log('✅ TrackingMore response:', trackingMoreResponse.data);

    // 📝 Create the tracking object explicitly
    const trackingData = {
      trackingNumber: trackingNumber,
      courierCode: carrierCode,
      status: 'pending',
      trackingUrl: `https://trackingmore.com/tracking.php?nums=${trackingNumber}&courier=${carrierCode}`,
      createdAt: new Date(),
      lastUpdated: new Date(),
      events: []
    };

    console.log('📝 Tracking data to save:', trackingData);

    // 📝 Update order with tracking info using explicit object
    console.log('📝 Updating order in database...');
    const updateResult = await orderModel.findByIdAndUpdate(
      orderId,
      {
        $set: {
          tracking: trackingData, // Set the entire tracking object
          status: mapStatus('pending') // Initial status
        },
        $push: {
          statusHistory: {
            status: mapStatus('pending'),
            changedAt: new Date(),
            notes: 'Tracking added by admin'
          }
        }
      },
      { 
        new: true, // Return updated document
        runValidators: true // Ensure schema validation runs
      }
    );

    console.log('✅ Order update result:', updateResult ? 'Success' : 'Failed');
    
    if (updateResult) {
      console.log('📊 Updated tracking object in DB:', JSON.stringify(updateResult.tracking, null, 2));
    }

    // 🔍 Verify the save worked by fetching fresh from DB
    const verifyOrder = await orderModel.findById(orderId).lean();
    console.log('🔍 Verification - Fresh order from DB:', {
      id: verifyOrder._id,
      tracking: verifyOrder.tracking,
      trackingKeys: verifyOrder.tracking ? Object.keys(verifyOrder.tracking) : 'No tracking'
    });

    // Alternative update method if the first one didn't work
    if (!verifyOrder.tracking?.courierCode) {
      console.log('⚠️ Carrier code not saved, trying alternative update method...');
      
      await orderModel.updateOne(
        { _id: orderId },
        {
          $set: {
            'tracking.trackingNumber': trackingNumber,
            'tracking.courierCode': carrierCode,
            'tracking.status': 'pending',
            'tracking.trackingUrl': `https://trackingmore.com/tracking.php?nums=${trackingNumber}&courier=${carrierCode}`,
            'tracking.createdAt': new Date(),
            'tracking.lastUpdated': new Date(),
            'tracking.events': []
          }
        }
      );

      console.log('✅ Alternative update completed');
      
      // Verify again
      const reVerifyOrder = await orderModel.findById(orderId).lean();
      console.log('🔍 Re-verification after alternative update:', {
        tracking: reVerifyOrder.tracking
      });
    }

    // 🔁 Get the final updated order
    const finalOrder = await orderModel.findById(orderId);
    
    // 🔔 Emit real-time updates
    console.log('🔔 Emitting real-time updates...');
    if (finalOrder?.userId) {
      console.log('📡 Emitting to user:', finalOrder.userId.toString());
      io.to(finalOrder.userId.toString()).emit('orderUpdated', finalOrder);
    }
    io.to('admin_room').emit('orderUpdatedAdmin', finalOrder);
    io.to(`order_${orderId}`).emit('orderStatusUpdate', finalOrder);

    console.log('✅ Successfully added tracking');
    return res.json({ 
      success: true, 
      message: 'Tracking added successfully',
      order: finalOrder,
      debug: {
        trackingData: finalOrder.tracking,
        carrierCodeSaved: !!finalOrder.tracking?.courierCode
      }
    });

  } catch (error) {
    console.error('❌ Error adding tracking:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      orderId: orderId,
      trackingNumber: trackingNumber,
      carrierCode: carrierCode
    });

    let errorMessage = 'Failed to add tracking';
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.meta?.message) {
      errorMessage = error.response.data.meta.message;
    }

    return res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Get real-time tracking info
export const getTrackingInfo = async (req, res) => {
  if (!req.params.orderId) {
    return res.status(400).json({
      success: false,
      message: "Order ID is missing for tracking."
    });
  }

  console.log('🔍 Starting tracking info fetch for order:', req.params.orderId);

  try {
    const order = await orderModel.findById(req.params.orderId);

    // DEBUG: Log the entire order object structure
    console.log('📦 Order found:', {
      id: order?._id,
      exists: !!order,
      hasTracking: !!order?.tracking,
      trackingKeys: order?.tracking ? Object.keys(order.tracking) : 'No tracking object'
    });

    if (!order) {
      console.log('❌ Order not found in database');
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // DEBUG: Log the complete tracking object
    console.log('🚚 Full tracking object:', JSON.stringify(order.tracking, null, 2));

    // DEBUG: Check all possible tracking field variations
    console.log('🔍 Tracking field analysis:', {
      'tracking.trackingNumber': order.tracking?.trackingNumber,
      'tracking.tracking_number': order.tracking?.tracking_number,
      'tracking.trackingId': order.tracking?.trackingId,
      'tracking.number': order.tracking?.number,
      'trackingNumber': order.trackingNumber,
      'tracking_number': order.tracking_number,
      'courierCode': order.tracking?.courierCode,
      'courier_code': order.tracking?.courier_code,
      'courier': order.tracking?.courier,
      'courierName': order.tracking?.courierName
    });

    // More flexible tracking number detection
    const trackingNumber = order.tracking?.trackingNumber || 
                          order.tracking?.tracking_number || 
                          order.tracking?.trackingId || 
                          order.tracking?.number ||
                          order.trackingNumber ||
                          order.tracking_number;

    const courierCode = order.tracking?.courierCode || 
                       order.tracking?.courier_code || 
                       order.tracking?.courier ||
                       order.tracking?.courierName;

    console.log('Detected values:', {
      trackingNumber,
      courierCode,
      hasTrackingNumber: !!trackingNumber,
      hasCourierCode: !!courierCode
    });

    if (!trackingNumber || !courierCode) {
      console.log(' Missing tracking info:', {
        missingTrackingNumber: !trackingNumber,
        missingCourierCode: !courierCode,
        availableFields: order.tracking ? Object.keys(order.tracking) : 'No tracking object'
      });
      
      return res.status(400).json({
        success: false,
        message: 'No tracking information available for this order',
        debug: {
          hasTracking: !!order.tracking,
          trackingFields: order.tracking ? Object.keys(order.tracking) : [],
          foundTrackingNumber: !!trackingNumber,
          foundCourierCode: !!courierCode
        }
      });
    }

    console.log('Making API call to TrackingMore with:', {
      trackingNumber,
      courierCode,
      apiKeyExists: !!API_KEY,
      apiKeyLength: API_KEY?.length || 0
    });

    // Call TrackingMore GET endpoint with tracking number
    const response = await axios.get(
      'https://api.trackingmore.com/v4/trackings/get',
      {
        headers: {
          'Tracking-Api-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        params: {
          tracking_numbers: trackingNumber,
          courier_code: courierCode // Add courier code to params
        }
      }
    );

    console.log('TrackingMore API Response:', {
      status: response.status,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : [],
      trackingCount: response.data?.data?.length || 0
    });

    // DEBUG: Log full API response
    console.log('Full API Response:', JSON.stringify(response.data, null, 2));

    const trackingList = response.data?.data;
    const trackingData = trackingList?.[0];

    console.log('Tracking Data Analysis:', {
      hasTrackingList: !!trackingList,
      trackingListLength: trackingList?.length || 0,
      hasTrackingData: !!trackingData,
      trackingDataKeys: trackingData ? Object.keys(trackingData) : []
    });

    if (!trackingData) {
      console.log('No tracking data returned from API');
      return res.status(404).json({
        success: false,
        message: 'Tracking data not found',
        debug: {
          apiResponse: response.data,
          trackingNumber,
          courierCode
        }
      });
    }

    console.log('Tracking data found:', {
      status: trackingData.status,
      currentOrderStatus: order.tracking?.status,
      statusChanged: trackingData.status !== order.tracking?.status
    });

    // If tracking status changed, update it in DB
    let latestCheckpointStatus = trackingData.status;
    const trackinfo = trackingData.origin_info?.trackinfo;
    if (Array.isArray(trackinfo) && trackinfo.length > 0) {
      latestCheckpointStatus = trackinfo[0].checkpoint_delivery_status || latestCheckpointStatus;
    }
    if (latestCheckpointStatus && latestCheckpointStatus !== order.tracking?.status) {
      console.log('Updating order status from', order.tracking?.status, 'to', latestCheckpointStatus);
      const newStatus = mapStatus(latestCheckpointStatus);
      console.log('Mapped status:', {
        trackingStatus: latestCheckpointStatus,
        mappedStatus: newStatus
      });
      const updatedOrder = await orderModel.findByIdAndUpdate(
        req.params.orderId,
        {
          $set: {
            'tracking.status': latestCheckpointStatus,
            'tracking.lastUpdated': new Date(),
            'tracking.events': trackinfo?.map(event => ({
              status: event.checkpoint_delivery_status || event.status || 'N/A',
              details: event.tracking_detail || event.Details || '',
              location: event.location || '',
              timestamp: new Date(event.checkpoint_date)
            })) || [],
            status: newStatus
          },
          $push: {
            statusHistory: {
              status: newStatus,
              changedAt: new Date(),
              notes: 'Status updated from tracking API'
            }
          }
        },
        { new: true }
      );

      console.log('Order updated successfully');

      // Emit WebSocket events to frontend (if io is available)
      if (typeof io !== 'undefined') {
        io.to(updatedOrder.userId.toString()).emit('orderUpdated', updatedOrder);
        io.to('admin_room').emit('orderUpdatedAdmin', updatedOrder);
        io.to(`order_${req.params.orderId}`).emit('orderStatusUpdate', updatedOrder);
        console.log('📡 WebSocket events emitted');
      } else {
        console.log('WebSocket (io) not available');
      }
    } else {
      console.log('ℹNo status update needed');
    }

    console.log('Returning tracking data successfully');

    return res.json({
      success: true,
      tracking: trackingData,
      debug: {
        trackingNumber,
        courierCode,
        orderTrackingStatus: order.tracking?.status,
        apiTrackingStatus: trackingData.status
      }
    });

  } catch (error) {
    console.error('Error fetching tracking info:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.response) {
      console.error('API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
    }

    if (typeof res !== 'undefined') {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch tracking information',
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          apiError: error.response?.data,
          apiStatus: error.response?.status
        } : undefined
      });
    } else {
      throw error;
    }
  }
};



// Webhook handler for TrackingMore updates
export const webhookHandler = async (req, res) => {
  const payload = req.body;

  try {
    const { tracking_number, courier_code, status, lastEvent } = payload;

    // Find and update the order
    const updatedOrder = await orderModel.findOneAndUpdate(
      { 'tracking.trackingNumber': tracking_number },
      {
        $set: {
          'tracking.status': status,
          'tracking.lastEvent': lastEvent,
          'tracking.lastUpdated': new Date(),
          status: mapStatus(status)
        },
        $push: {
          statusHistory: {
            status: mapStatus(status),
            changedAt: new Date(),
            notes: 'Status updated via webhook'
          }
        }
      },
      { new: true }
    );

    if (updatedOrder) {
      // Emit real-time updates
      io.to(updatedOrder.userId.toString()).emit('orderUpdated', updatedOrder);
      io.to('admin_room').emit('orderUpdatedAdmin', updatedOrder);
      io.to(`order_${updatedOrder._id.toString()}`).emit('orderStatusUpdate', updatedOrder);
    }

    return res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).send('Error processing webhook');
  }
};

// Get supported carriers
export const getCarriers = async (req, res) => {
  try {
    const response = await axios.get('https://api.trackingmore.com/v4/carriers', {
      headers: {
        'Tracking-Api-Key': API_KEY
      }
    });

    // Filter for Philippine carriers
    const phCarriers = response.data.data.filter(carrier => 
      carrier.country_code === 'PH' || 
      carrier.courier_code === 'jtexpress-ph'
    );

    return res.json({
      success: true,
      carriers: phCarriers
    });
  } catch (error) {
    console.error('Error fetching carriers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch carriers'
    });
  }
};

// Detect carrier from tracking number
export const detectCarrier = async (req, res) => {
  const { trackingNumber } = req.body;

  if (!trackingNumber) {
    return res.status(400).json({
      meta: {
        code: 400,
        message: 'trackingNumber is required'
      },
      data: null
    });
  }

  try {
   const response = await axios.post(
  'https://api.trackingmore.com/v4/carriers/detect', // <-- 🔥 THIS IS THE FIX
  { tracking_number: trackingNumber },
  {
    headers: {
      'Content-Type': 'application/json',
      'Tracking-Api-Key': API_KEY
    }
  }
);


    return res.status(200).json(response.data);

  } catch (error) {
    console.error('Error from TrackingMore:', {
      status: error.response?.status,
      data: error.response?.data
    });

    return res.status(error.response?.status || 500).json({
      meta: {
        code: error.response?.data?.meta?.code || 500,
        message: error.response?.data?.meta?.message || 'Failed to detect carrier'
      },
      data: null
    });
  }
};

// Bulk update all orders' statuses from TrackingMore
export const syncAllOrderStatuses = async (req, res) => {
  try {
    const orders = await orderModel.find({ 'tracking.trackingNumber': { $exists: true, $ne: null } });
    let updatedCount = 0;
    let errors = [];

    for (const order of orders) {
      const trackingNumber = order.tracking?.trackingNumber;
      const courierCode = order.tracking?.courierCode;
      if (!trackingNumber || !courierCode) continue;

      try {
        const response = await axios.get(
          'https://api.trackingmore.com/v4/trackings/get',
          {
            headers: {
              'Tracking-Api-Key': API_KEY,
              'Content-Type': 'application/json'
            },
            params: {
              tracking_numbers: trackingNumber,
              courier_code: courierCode
            }
          }
        );
        const trackingList = response.data?.data;
        const trackingData = trackingList?.[0];
        if (trackingData) {
          let latestCheckpointStatus = trackingData.status;
          const trackinfo = trackingData.origin_info?.trackinfo;
          if (Array.isArray(trackinfo) && trackinfo.length > 0) {
            latestCheckpointStatus = trackinfo[0].checkpoint_delivery_status || latestCheckpointStatus;
          }
          if (latestCheckpointStatus) {
            const newStatus = mapStatus(latestCheckpointStatus);
            await orderModel.findByIdAndUpdate(
              order._id,
              {
                $set: {
                  'tracking.status': latestCheckpointStatus,
                  'tracking.lastUpdated': new Date(),
                  status: newStatus
                },
                $push: {
                  statusHistory: {
                    status: newStatus,
                    changedAt: new Date(),
                    notes: 'Status synced from TrackingMore (bulk update)'
                  }
                }
              }
            );
            updatedCount++;
          }
        }
      } catch (err) {
        errors.push({ orderId: order._id, error: err.message });
      }
    }
    res.json({ success: true, updatedCount, errors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
