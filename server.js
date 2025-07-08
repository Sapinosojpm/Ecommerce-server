import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/mongodb.js';
import { connectCloudinary } from './config/cloudinary.js';
import userRouter from './routes/userRoute.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRoute.js';
import orderRouter from './routes/orderRoute.js';
import chatRouter from './routes/chatRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import heroRoutes from './routes/heroRoutes.js';
import footerRoutes from './routes/footerRoutes.js';
import aboutRoutes from './routes/aboutRoutes.js';
import path from 'path';
import fs from 'fs';
import contactRoutes from './routes/contactRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { OAuth2Client } from 'google-auth-library';
import userModel from './models/userModel.js';
import cardRoutes from "./routes/cardRoutes.js";
import introRouter from './routes/introRoutes.js';
import memberCardRouter from './routes/memberCardRouter.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import dealRoutes from './routes/dealRoutes.js';
import eventRoutes from "./routes/eventRoutes.js";
import AIChatRouter from './routes/AIChatRouter.js';
import chatRoutes from './routes/chatRoutes.js';
import dotenv from "dotenv";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import youtubeRoutes from './routes/youtubeRoutes.js';
import adminDiscountRoutes from './routes/adminDiscountRoutes.js';
import { EventEmitter } from 'events';
import faqRoutes from "./routes/faq.js";
import adminRouter from './routes/userRoute.js';
import facebookRouter from './routes/authFbRoutes.js';
import discountRoutes from "./routes/discountRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import subscriberRoutes from './routes/subscriberRoutes.js';
import logoRoutes from "./routes/logoRoutes.js";
import policyRoutes from './routes/policyRoutes.js';
import homePageRoutes from './routes/homePageRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import regionRoutes from './routes/regionRoutes.js';
import pageViewRoutes from './routes/pageViewRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import WeightFeeRoutes from './routes/WeightFeeRoutes.js';
import bestSellerRoutes from './routes/bestSellerRoutes.js';
import latestProductRoutes from "./routes/latestProductRoutes.js";
import VoucherAmountRoutes from "./routes/VoucherAmountRoutes.js";
import productReviewRoutes from "./routes/productReviewRoutes.js";
import adRoutes from "./routes/adRoutes.js";
import navbarRoutes from "./routes/navbarRoutes.js";
import otpRoutes from './routes/otpRoutes.js';
import liveSellingRoutes from './routes/liveSellingRoutes.js';
import Order from './models/orderModel.js';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import liveStreamRoutes from './routes/liveStreamRoutes.js';
import liveChatRoutes from './routes/liveChatRoutes.js';

import { 
  createMediasoupWorker, 
  createMediasoupRouter, 
  createWebRtcTransport,
  getProducerTransport,
  getConsumerTransport,
  setProducer,
  setConsumer,
  getProducer,
  getConsumer,
  getRouter,
  getRouterRtpCapabilities,
  cleanupSocketResources
} from './mediasoupSetup.js';
import returnRouter from './routes/returnRoute.js';
import googleAuthRouter from './routes/googleAuthRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import session from 'express-session';
import passport from './facebookAuth.js';
import MongoStore from 'connect-mongo';
import crypto from 'crypto';

dotenv.config();

// Initialize the app
const app = express();
const port = process.env.PORT || 4000;

// Define allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5174",
  "https://ecommerce-frontend-six-tau.vercel.app",
  "https://ecommerce-frontend-admin-tawny.vercel.app",
  "https://ecommerce-frontend-git-main-john-paul-milles-projects.vercel.app"
];

// Create Mediasoup worker and router
await createMediasoupWorker();
await createMediasoupRouter();
console.log('Mediasoup worker and router created');

// Create HTTP server and Socket.IO instance
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Set __dirname for ES modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Connect to Database and Cloudinary
connectDB();
connectCloudinary();
EventEmitter.defaultMaxListeners = 30;

// Serve static files from the 'uploads' folder
app.use('/uploads', (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Ensure the 'uploads' folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const uploadPath = path.join(__dirname, "uploads/videos");
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// Middleware
app.use(express.json());

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS error: Origin not allowed'));
    }
  },
  credentials: true
}));

// Debug: log session, headers, and cookies for every request
app.use((req, res, next) => {
  console.log('Session:', req.session);
  console.log('Headers:', req.headers);
  console.log('Cookies:', req.cookies);
  next();
});

// Chat system variables
const activeAdmins = new Set();
const userChatRooms = new Map(); // Stores chat history per user
const onlineUsers = new Set(); // Track online users

// Add session and passport middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_random_secret',
  resave: false,
  saveUninitialized: false, // CHANGED from true to false for proper session handling
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    sameSite: 'none', // REQUIRED for cross-domain cookies (Vercel/Render)
    secure: true,     // REQUIRED for HTTPS (production)
    // domain: '.yourdomain.com', // Uncomment and set if frontend/backend are on subdomains
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Facebook OAuth routes
import axios from 'axios';

app.get('/api/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'pages_show_list', 'pages_read_engagement', 'pages_manage_posts'] }));

// In-memory token store for Facebook access tokens
const fbTokenStore = new Map();

// Facebook OAuth callback: generate token, store mapping, redirect to frontend with token
app.get('/api/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login', session: false }),
  (req, res) => {
    const fbAccessToken = req.user.accessToken;
    const token = crypto.randomBytes(32).toString('hex');
    fbTokenStore.set(token, fbAccessToken);
    // Redirect to frontend with token in URL
    res.redirect(`${process.env.FRONTEND_URL}/facebook-manager?token=${token}`);
  }
);

// Middleware to require and validate token, set req.fbAccessToken
function requireFBToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = auth.split(' ')[1];
  const fbAccessToken = fbTokenStore.get(token);
  if (!fbAccessToken) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.fbAccessToken = fbAccessToken;
  next();
}

// Facebook API endpoints using token-based auth
app.get('/api/facebook/pages', requireFBToken, async (req, res) => {
  try {
    const response = await axios.get(`https://graph.facebook.com/v18.0/me/accounts?access_token=${req.fbAccessToken}`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.post('/api/facebook/post', requireFBToken, async (req, res) => {
  const { pageId, message, product } = req.body;
  try {
    // Get Page Access Token
    const pageRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}?fields=access_token&access_token=${req.fbAccessToken}`);
    const pageAccessToken = pageRes.data.access_token;
    let postMessage = message;
    let imageUrl = null;
    if (product) {
      postMessage = `New Product: ${product.name}\nPrice: $${product.price}\n${product.description || ''}`;
      imageUrl = product.imageUrl;
    }
    let fbResponse;
    if (imageUrl) {
      fbResponse = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
        url: imageUrl,
        caption: postMessage,
        access_token: pageAccessToken
      });
    } else {
      fbResponse = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
        message: postMessage,
        access_token: pageAccessToken
      });
    }
    res.json(fbResponse.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join the admin room if the user is an admin
   // Admin availability
  socket.on('set-admin-availability', async ({ isAvailable }) => {
    if (socket.userRole !== 'admin') return;
    
    try {
      await User.findByIdAndUpdate(socket.userId, { isAvailable });
      io.emit('admin-availability', { 
        adminId: socket.userId, 
        isAvailable 
      });
    } catch (error) {
      console.error('Error updating admin availability:', error);
    }
  });

  // Typing indicators
  socket.on('typing', ({ recipientId, isTyping }) => {
    if (!socket.userId) return;
    
    if (socket.userRole === 'admin') {
      io.to(recipientId).emit('admin-typing', isTyping);
    } else {
      socket.to('admin-room').emit('user-typing', {
        userId: socket.userId,
        isTyping
      });
    }
  });

  // Join user-specific room
  socket.on('join-user-room', (userId) => {
    socket.join(userId);
  });

  // =========================================================


  // mediasoup
 // Mediasoup WebRTC transport creation
 socket.on('createWebRtcTransport', async ({ sender }, callback) => {
  try {
    const isProducer = sender;
    const transport = await createWebRtcTransport(socket.id, isProducer);
    
    callback({
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    });
  } catch (error) {
    console.error('createWebRtcTransport error:', error);
    callback({ error: error.message });
  }
});

// Connect producer transport
socket.on('connectProducerTransport', async ({ dtlsParameters }, callback) => {
  try {
    const producerTransport = getProducerTransport(socket.id);
    if (!producerTransport) {
      throw new Error('Producer transport not found');
    }
    
    await producerTransport.connect({ dtlsParameters });
    callback({ success: true });
  } catch (error) {
    console.error('connectProducerTransport error:', error);
    callback({ error: error.message });
  }
});

// Connect consumer transport
socket.on('connectConsumerTransport', async ({ dtlsParameters }, callback) => {
  try {
    const consumerTransport = getConsumerTransport(socket.id);
    if (!consumerTransport) {
      throw new Error('Consumer transport not found');
    }
    
    await consumerTransport.connect({ dtlsParameters });
    callback({ success: true });
  } catch (error) {
    console.error('connectConsumerTransport error:', error);
    callback({ error: error.message });
  }
});

// Produce media
socket.on('produce', async ({ kind, rtpParameters }, callback) => {
  try {
    const producerTransport = getProducerTransport(socket.id);
    if (!producerTransport) {
      throw new Error('Producer transport not found');
    }
    
    const producer = await producerTransport.produce({
      kind,
      rtpParameters,
    });

    setProducer(socket.id, producer);
    callback({ id: producer.id });

    producer.on('score', (score) => {
      socket.emit('producerScore', { score });
    });
  } catch (error) {
    console.error('produce error:', error);
    callback({ error: error.message });
  }
});

// Consume media
socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
  try {
    const router = getRouter();
    if (!router) {
      throw new Error('Router not found');
    }
    
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume');
    }

    const consumerTransport = getConsumerTransport(socket.id);
    if (!consumerTransport) {
      throw new Error('Consumer transport not found');
    }
    
    const consumer = await consumerTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    setConsumer(socket.id, consumer);

    consumer.on('transportclose', () => {
      console.log('Transport for consumer closed');
    });

    callback({
      params: {
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      },
    });
  } catch (error) {
    console.error('consume error:', error);
    callback({ error: error.message });
  }
});

// Resume consumer (start receiving media)
socket.on('resume', async ({ consumerId }, callback) => {
  try {
    const consumer = getConsumer(socket.id, consumerId);
    if (!consumer) {
      throw new Error('Consumer not found');
    }
    
    await consumer.resume();
    callback({ success: true });
  } catch (error) {
    console.error('resume error:', error);
    callback({ error: error.message });
  }
});

// Get router capabilities
socket.on('getRouterRtpCapabilities', (callback) => {
  try {
    const capabilities = getRouterRtpCapabilities();
    callback({ rtpCapabilities: capabilities });
  } catch (error) {
    console.error('getRouterRtpCapabilities error:', error);
    callback({ error: error.message });
  }
});

// Clean up on disconnect
socket.on('disconnect', () => {
  console.log('Client disconnected:', socket.id);
  cleanupSocketResources(socket.id);
});

// Live selling specific events
socket.on('join-live-selling', (productId) => {
  socket.join(`live-selling-${productId}`);
  console.log(`Client joined live selling room for product ${productId}`);
});

socket.on('leave-live-selling', (productId) => {
  socket.leave(`live-selling-${productId}`);
  console.log(`Client left live selling room for product ${productId}`);
});

socket.on('live-selling-comment', ({ productId, comment, userId }) => {
  io.to(`live-selling-${productId}`).emit('new-live-selling-comment', {
    userId,
    comment,
    timestamp: Date.now()
  });
});

// =============================================================

  // Handle authentication
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      
      if (socket.userRole === 'admin') {
        activeAdmins.add(socket.id);
        io.emit('admin-status', 'online');
        console.log(`Admin ${socket.userId} connected`);
      } else {
        onlineUsers.add(socket.userId);
        socket.join(socket.userId);
        io.to('admin-room').emit('user-connected', socket.userId);
        socket.emit('admin-status', activeAdmins.size > 0 ? 'online' : 'offline');
        console.log(`User ${socket.userId} connected`);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      socket.disconnect();
    }
  });

  // Chat functionality
  socket.on('chat-message', (message) => {
    if (!socket.userId) return;

    // Store message in memory
    if (!userChatRooms.has(message.sender)) {
      userChatRooms.set(message.sender, []);
    }
    const userMessages = userChatRooms.get(message.sender);
    userMessages.push(message);
    
    // Keep only the last 100 messages
    if (userMessages.length > 100) {
      userChatRooms.set(message.sender, userMessages.slice(-100));
    }
    
    // Emit to recipient
    if (message.isAdmin) {
      // Admin sending to user
      io.to(message.recipient).emit('chat-message', message);
    } else {
      // User sending to admin
      socket.to('admin-room').emit('chat-message', message);
      io.to(message.sender).emit('chat-message', message); // Echo back to sender
    }
  });

  socket.on('get-chat-history', (userId, callback) => {
    const history = userChatRooms.get(userId) || [];
    callback(history);
  });

  socket.on('user-typing', (typing) => {
    if (!socket.userId) return;
    socket.to('admin-room').emit('user-typing', {
      userId: socket.userId,
      typing
    });
  });

  socket.on('admin-typing', ({ userId, typing }) => {
    if (socket.userRole !== 'admin') return;
    io.to(userId).emit('admin-typing', typing);
  });

  // Admin joins admin room
  socket.on('admin-join', () => {
    if (socket.userRole !== 'admin') return;
    socket.join('admin-room');
    activeAdmins.add(socket.id);
    io.emit('admin-status', 'online');
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (socket.userRole === 'admin') {
      activeAdmins.delete(socket.id);
      if (activeAdmins.size === 0) {
        io.emit('admin-status', 'offline');
      }
    } else if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.to('admin-room').emit('user-disconnected', socket.userId);
    }
  });

  // Existing functionality for other features
  socket.on('joinUserRoom', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('joinProductRoom', (productId) => {
    socket.join(`product_${productId}`);
    console.log(`Client joined product room: ${productId}`);
  });

  socket.on('joinOrderRoom', (orderId) => {
    socket.join(`order_${orderId}`);
    console.log(`Client joined order room: ${orderId}`);
  });

  socket.on('joinAdminRoom', () => {
    socket.join('admin-room');
    console.log(`Admin joined admin room`);
  });
  

  // Live streaming handlers
  let viewers = new Map();
  
  socket.on('viewer-join', () => {
    console.log('Viewer joined:', socket.id);
    viewers.set(socket.id, { 
      timestamp: Date.now(),
      role: 'viewer'
    });
    io.emit('viewer-count', viewers.size);
    socket.to('admin-room').emit('viewer-join', socket.id);
  });

  socket.on('admin-join', () => {
    console.log('Admin joined:', socket.id);
    socket.join('admin-room');
    viewers.set(socket.id, {
      timestamp: Date.now(),
      role: 'admin'
    });
  });

  socket.on('admin-leave', () => {
    console.log('Admin left');
    socket.leave('admin-room');
    io.emit('stream-ended');
  });

  socket.on('stop-stream', () => {
    console.log('Stream stopped by admin');
    io.emit('stream-ended');
  });

  socket.on('viewer-leave', () => {
    console.log('Viewer left:', socket.id);
    viewers.delete(socket.id);
    io.emit('viewer-count', viewers.size);
  });

  // WebRTC signaling
  socket.on('offer', ({ target, offer }) => {
    console.log(`Relaying offer from ${socket.id} to ${target}`);
    io.to(target).emit('offer', { offer });
  });

  socket.on('answer', ({ viewerId, answer }) => {
    console.log(`Relaying answer from ${viewerId || socket.id} to admin`);
    socket.to('admin-room').emit('answer', { 
      viewerId: viewerId || socket.id, 
      answer 
    });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    console.log(`Relaying ICE candidate from ${socket.id} to ${target}`);
    io.to(target).emit('ice-candidate', { 
      viewerId: socket.id, 
      candidate 
    });
  });

  socket.on('post-comment', ({ comment, name }) => {
    if (comment && comment.trim()) {
      console.log(`New comment from ${name || socket.id}: ${comment}`);
      io.emit('new-comment', { comment, name });
    }
  });
});

// Enhanced MongoDB Change Streams for real-time updates
async function setupChangeStreams() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  // Watch orders collection
  const ordersCollection = db.collection('orders');
  const orderChangeStream = ordersCollection.watch();
  
  // Watch users collection for cart updates
  const usersCollection = db.collection('users');
  const userChangeStream = usersCollection.watch();
  
  // Watch products collection for inventory updates
  const productsCollection = db.collection('products');
  const productChangeStream = productsCollection.watch();

  orderChangeStream.on('change', async (change) => {
    try {
      if (!change.documentKey || !change.documentKey._id) return;

      const orderId = change.documentKey._id.toString();
      
      if (change.operationType === 'insert') {
        const newOrder = change.fullDocument;
        if (!newOrder) return;

        if (newOrder.user) {
          io.to(newOrder.user.toString()).emit('newOrder', newOrder);
        }
        
        io.to('admin-room').emit('newOrderAdmin', newOrder);
        io.to(`order_${orderId}`).emit('orderStatusUpdate', newOrder);
        
        console.log(`New order notification sent for order ${orderId}`);
      } else if (change.operationType === 'update') {
        const updatedOrder = await ordersCollection.findOne({ _id: change.documentKey._id });
        if (!updatedOrder) return;

        if (updatedOrder.user) {
          io.to(updatedOrder.user.toString()).emit('orderUpdated', updatedOrder);
        }
        
        io.to('admin-room').emit('orderUpdatedAdmin', updatedOrder);
        io.to(`order_${orderId}`).emit('orderStatusUpdate', updatedOrder);
        
        console.log(`Order update notification sent for order ${orderId}`);
      }
    } catch (error) {
      console.error('Error processing order change stream:', error);
    }
  });

  userChangeStream.on('change', async (change) => {
    try {
      if (!change.documentKey || !change.documentKey._id) return;
      
      const userId = change.documentKey._id.toString();
      
      if (change.operationType === 'update' && change.updateDescription?.updatedFields?.cart) {
        io.to(userId).emit('cartUpdated', change.updateDescription.updatedFields.cart);
      }
    } catch (error) {
      console.error("Error processing user change stream:", error);
    }
  });

  productChangeStream.on('change', async (change) => {
    try {
      if (!change.documentKey || !change.documentKey._id) return;

      const productId = change.documentKey._id.toString();
      
      if (change.operationType === 'update') {
        const updatedFields = change.updateDescription?.updatedFields || {};
        const updatedProduct = await productsCollection.findOne({ _id: change.documentKey._id });
        
        // Emit to all clients interested in this product
        io.to(`product_${productId}`).emit('productUpdated', updatedProduct);
        
        // Also emit to admin room for dashboard updates
        io.to('admin-room').emit('productInventoryUpdated', {
          productId,
          updatedFields
        });
        
        console.log(`Product update sent for ${productId}`);
      }
    } catch (error) {
      console.error("Error processing product change stream:", error);
    }
  });
}

// Start MongoDB change streams
setupChangeStreams().catch(console.error);

// Use routes
app.use('/api/tracking', trackingRoutes);
app.use('/api/chat', liveChatRoutes);
app.use('/api/returns', returnRouter);
app.use('/api/livestream', liveStreamRoutes); 
app.use('/api/live-selling', liveSellingRoutes);
app.use('/api/otp', otpRoutes);
app.use("/api/navbar-links", navbarRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/product-reviews", productReviewRoutes);
app.use("/api/latest-products", latestProductRoutes);
app.use("/api/best-seller-setting", bestSellerRoutes);
app.use("/api/weight", WeightFeeRoutes);
app.use("/api/location", locationRoutes);
app.use('/api/pageviews', pageViewRoutes);
app.use("/api/regions", regionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/homepage', homePageRoutes);
app.use('/api/policies', policyRoutes);
app.use("/api/logo", logoRoutes);
app.use("/api/youtube", youtubeRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api", discountRoutes);
app.use("/api/user", facebookRouter);
app.use("/api", eventRoutes);
app.use('/api', uploadRoutes);
app.use('/api', dealRoutes);
app.use("/api/card", cardRoutes);
app.use('/api', subscriptionRoutes);
app.use("/api/memberCard", memberCardRouter);
app.use("/api/intro", introRouter);
app.use('/api/user', userRouter);
app.use('/api/product', productRouter);
app.use('/api/cart', cartRouter);
app.use('/api/order', orderRouter);
app.use('/api', chatRouter);
app.use('/api', profileRoutes);
app.use('/api', heroRoutes);
app.use('/api', footerRoutes);
app.use('/api', aboutRoutes);
app.use('/api', contactRoutes);
app.use("/api", reviewRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/", jobRoutes);
app.use('/api/youtube-url', youtubeRoutes);
app.use("/api/admin/discounts", adminDiscountRoutes);
app.use("/api/faqs", faqRoutes);
app.use('/api', adminRouter);
app.use(paymentRoutes);
app.use("/api/paymongo/webhook", express.json());
app.use("/api/voucher-amounts", VoucherAmountRoutes);
app.use("/api", AIChatRouter)

// Use Google authentication routes
app.use('/api/auth', googleAuthRouter);

// Update the server listen function at the bottom of your file
// Replace the existing httpServer.listen() call with this:

httpServer.listen(port, () => {
  console.log(`Server started on PORT: ${port}`);
  console.log('Socket.IO server running');
});

export { io };