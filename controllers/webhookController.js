// controllers/webhookController.js
import orderModel from '../models/orderModel.js';

const jtWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;
    
    // Validate webhook signature if needed
    // const signature = req.headers['x-jt-signature'];
    
    if (event === 'status_update') {
      const order = await orderModel.findOne({ jtTrackingNumber: data.tracking_number });
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found." });
      }

      order.shippingStatus = mapJTStatus(data.status);
      order.shippingHistory.push({
        status: data.status,
        location: data.location,
        timestamp: new Date(data.timestamp),
        notes: data.remarks
      });

      await order.save();

      // Notify user if significant status change
      if (['delivered', 'failed'].includes(order.shippingStatus)) {
        io.to(order.userId.toString()).emit('shippingUpdate', {
          orderId: order._id,
          status: order.shippingStatus,
          trackingNumber: order.jtTrackingNumber
        });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("J&T Webhook Error:", error);
    return res.status(500).json({ success: false, message: "Webhook processing failed." });
  }
};

// Map J&T status codes to your system
const mapJTStatus = (jtStatus) => {
  const statusMap = {
    'pickup': 'pickup_scheduled',
    'transit': 'in_transit',
    'delivering': 'out_for_delivery',
    'delivered': 'delivered',
    'failed': 'failed',
    'returned': 'failed'
  };
  return statusMap[jtStatus] || 'pending';
};

export { jtWebhook };