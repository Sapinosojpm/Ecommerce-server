// services/jtExpressService.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const JT_API_URL = 'https://api.jtexpress.ph';
const JT_CLIENT_ID = process.env.JT_CLIENT_ID;
const JT_CLIENT_SECRET = process.env.JT_CLIENT_SECRET;
const JT_PARTNER_ID = process.env.JT_PARTNER_ID;

let accessToken = '';
let tokenExpiry = 0;

// Authenticate with J&T API
const authenticate = async () => {
  try {
    const response = await axios.post(`${JT_API_URL}/oauth/access_token`, {
      client_id: JT_CLIENT_ID,
      client_secret: JT_CLIENT_SECRET,
      grant_type: 'client_credentials'
    });
    
    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return accessToken;
  } catch (error) {
    console.error('J&T Authentication Error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with J&T API');
  }
};

// Get valid access token (renews if expired)
const getAccessToken = async () => {
  if (!accessToken || Date.now() >= tokenExpiry) {
    await authenticate();
  }
  return accessToken;
};

// Create a shipment order
export const createJTOrder = async (orderData) => {
  try {
    const token = await getAccessToken();
    
    const payload = {
      partner_id: JT_PARTNER_ID,
      order_id: orderData.orderNumber,
      sender_info: {
        name: 'Your Store Name',
        phone: '09123456789',
        address: 'Your Store Address',
        province: 'Metro Manila',
        city: 'Manila',
        barangay: 'Barangay Name',
        postal_code: '1000'
      },
      receiver_info: {
        name: `${orderData.address.firstName} ${orderData.address.lastName}`,
        phone: orderData.address.phone,
        address: orderData.address.street,
        province: orderData.address.province,
        city: orderData.address.city,
        barangay: orderData.address.barangay,
        postal_code: orderData.address.postalCode
      },
      package_info: {
        actual_weight: calculateTotalWeight(orderData.items), // in kg
        length: 20, // in cm
        width: 15,  // in cm
        height: 10, // in cm
        declared_value: orderData.amount,
        payment_type: orderData.paymentMethod === 'COD' ? 1 : 0, // 1=COD, 0=Prepaid
        cod_amount: orderData.paymentMethod === 'COD' ? orderData.amount : 0,
        items: orderData.items.map(item => ({
          item_name: item.name,
          quantity: item.quantity,
          item_value: item.price
        }))
      }
    };

    const response = await axios.post(`${JT_API_URL}/order/create`, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('J&T Order Creation Error:', error.response?.data || error.message);
    throw new Error('Failed to create J&T order');
  }
};

// Track a shipment
export const trackJTOrder = async (trackingNumber) => {
  try {
    const token = await getAccessToken();
    
    const response = await axios.get(`${JT_API_URL}/order/track`, {
      params: { tracking_number: trackingNumber },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('J&T Tracking Error:', error.response?.data || error.message);
    throw new Error('Failed to track J&T order');
  }
};

// Calculate total weight of items (simplified)
const calculateTotalWeight = (items) => {
  // Assuming each item weighs 0.5kg by default
  // You should replace this with actual product weights from your database
  return items.reduce((total, item) => total + (item.quantity * 0.5), 0);
};