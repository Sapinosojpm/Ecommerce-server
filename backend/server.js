import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './config/mongodb.js';
import connectCloudinary from './config/cloudinary.js';
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
import resetPassword from './routes/resetPassword.js';
import uploadRoutes from './routes/uploadRoutes.js'; // Import the upload route
import { OAuth2Client } from 'google-auth-library';  // Import the google-auth-library
import userModel from './models/userModel.js'; // Assuming you have a user model
import cardRoutes from "./routes/cardRoutes.js"; // Import the new routes
import introRouter from './routes/introRoutes.js'; // Intro routes
import memberCardRouter from './routes/memberCardRouter.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import dealRoutes from './routes/dealRoutes.js';
// import importRoutes from './routes/importRoute.js';
import eventRoutes from "./routes/eventRoutes.js"; // use import with .js extension
import AIChatRouter from './routes/AIChatRouter.js'; 
import chatRoutes from './routes/chatRoutes.js'; 
import dotenv from "dotenv";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import youtubeRoutes from './routes/youtubeRoutes.js';
import adminDiscountRoutes from './routes/adminDiscountRoutes.js';
import { EventEmitter } from 'events';
import authRoutes from "./routes/authRoutes.js";
import faqRoutes from "./routes/faq.js";
import adminRouter from './routes/userRoute.js';
import facebookRouter from './routes/authFbRoutes.js';
import orderImportRouter from './routes/importOrderRoutes.js'
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

dotenv.config();
console.log(process.env.OPENAI_API_KEY);
// Initialize the app
const app = express();
const port = process.env.PORT || 4000;


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
  origin: ['http://localhost:5174', 'http://localhost:5173','http://localhost:4000'], // Multiple allowed origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use("/api/order", orderImportRouter);
console.log("✅ Import Order Route Loaded");
console.log("✅ Registering VoucherAmountRoutes...");
console.log("✅ VoucherAmountRoutes Loaded!");

// Use routes

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
app.use("/api/auth", authRoutes); // Use the authentication routes
app.use('/api', chatRoutes); // Use chat routes under /api
// Use the AIChatRouter to handle routes under /api
app.use('/api', AIChatRouter);
// Use event routes
app.use("/api", eventRoutes);
// app.use('/api/import', importRoutes);  // Make sure the '/api/import' path is used
// app.use('/api/order', importRoutes);
app.use('/api', uploadRoutes);
app.use('/api', resetPassword);
app.use('/api', dealRoutes);
app.use("/api/card", cardRoutes);
app.use('/api', subscriptionRoutes);
app.use("/api/memberCard", memberCardRouter);
app.use("/api/intro", introRouter);
app.use('/api/user', userRouter);
app.use('/api/product', productRouter);
app.use('/api/cart', cartRouter);
app.use('/api/order', orderRouter);
app.use('/api', chatRouter); // Chat routes
app.use('/api', profileRoutes);
app.use('/api', heroRoutes);
app.use('/api', footerRoutes);
app.use('/api', aboutRoutes); // Mount About routes under /api
app.use('/api', contactRoutes);
app.use("/api", reviewRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/", jobRoutes);
app.use('/api/youtube-url', youtubeRoutes);
app.use("/api/admin/discounts", adminDiscountRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/faqs", faqRoutes);
app.use('/api', adminRouter);  
app.use(paymentRoutes);
app.use("/api/paymongo/webhook", express.json());
app.use("/api/voucher-amounts", VoucherAmountRoutes);

// Google Login Route
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Google OAuth2 client

import jwt from 'jsonwebtoken';

app.post('/api/user/google-login', async (req, res) => {
  const { credential } = req.body; // Google token from frontend
  try {
    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID, // Ensure this is your correct Google Client ID
    });

    console.log("Google Token received:", credential);

    // Extract user details from Google
    const payload = ticket.getPayload();
    const { email, given_name, family_name } = payload;

    // Check if user exists in the database
    let user = await userModel.findOne({ email });

    if (!user) {
      // If user doesn't exist, create a new one with a default role
      user = new userModel({
        firstName: given_name,
        lastName: family_name,
        email,
        role: "user", // Default role for new users
      });
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Send token and role back to frontend
    res.json({ success: true, token, role: user.role });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(400).json({ success: false, message: 'Google login failed!' });
  }
});


app.post("/auth/google-signup", async (req, res) => {
  const { token } = req.body;
  try {
      const ticket = await client.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID,
      });

      const { sub, name, email, picture } = ticket.getPayload();

      let user = await User.findOne({ googleId: sub });

      if (!user) {
          user = new User({ googleId: sub, name, email, picture });
          await user.save();
      }

      res.json({ success: true, user });
  } catch (error) {
      res.status(401).json({ success: false, message: "Invalid token" });
  }
});


app.post("/api/paymongo/webhook", async (req, res) => {
  try {
      const event = req.body;

      console.log("🔔 PayMongo Webhook Received:", event);

      if (event.data && event.data.attributes.status === "paid") {
          const sourceId = event.data.id; // Get PayMongo source ID
          const userId = event.data.attributes.metadata.userId; // Get user ID from metadata
          
          console.log(`✅ Payment successful for User ID: ${userId}`);

          // Find the user's cart
          const user = await userModel.findById(userId);
          if (!user) return res.status(404).json({ message: "User not found" });

          // Create an order using cart items
          const newOrder = new Order({
              user: userId,
              products: user.cart, // Assuming the cart holds products
              totalAmount: event.data.attributes.amount / 100, // Convert to PHP
              paymentStatus: "paid",
              paymentId: sourceId,
          });

          await newOrder.save(); // Save the order

          // Clear user's cart
          user.cart = [];
          await user.save();

          console.log("✅ Order created and cart cleared!");
          return res.status(200).json({ message: "Order placed successfully!" });
      } else {
          console.log("⚠️ Payment not completed yet.");
      }

      res.sendStatus(200);
  } catch (error) {
      console.error("❌ Webhook Error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
  }
});

// console.log("✅ Registered Routes:");
// app._router.stack.forEach((middleware) => {
//   if (middleware.route) {
//       console.log(middleware.route);
//   } else if (middleware.name === "router") {
//       middleware.handle.stack.forEach((handler) => {
//           if (handler.route) {
//               console.log(handler.route);
//           }
//       });
//   }
// });


app.listen(port, () => console.log('Server started on PORT: ' + port));
