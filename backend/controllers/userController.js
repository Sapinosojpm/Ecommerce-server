import axios from 'axios';
import validator from 'validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import { OAuth2Client } from 'google-auth-library'; // Import the Google OAuth2Client

// Helper function to create a JWT token
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });  // Added expiry
};

// Google OAuth client using environment variable
const client = new OAuth2Client("process.env.GOOGLE_CLIENT_ID"); // Use the environment variable for Google Client ID




// Route for user login
const loginUser = async (req, res) => {
  try {
    const { email, password, captcha } = req.body;

    // Verify reCAPTCHA
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const captchaResponse = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: secretKey,
        response: captcha,
      },
    });

    console.log('CAPTCHA Response:', captchaResponse.data); // For debugging

    if (!captchaResponse.data.success) {
      return res.status(400).json({ success: false, message: 'CAPTCHA verification failed' });
    }

    // Proceed with user login if CAPTCHA is verified
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "User doesn't exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      const token = createToken(user._id);
      res.json({ success: true, token, role: user.role }); // ✅ Send role
    } else {
      res.json({ success: false, message: 'Invalid Credentials' });
    }
    
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Route for user registration
const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, captcha } = req.body;

    // Verify reCAPTCHA
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const captchaResponse = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: { secret: secretKey, response: captcha },
    });

    console.log('CAPTCHA Response:', captchaResponse.data); // Debugging

    if (!captchaResponse.data.success) {
      return res.status(400).json({ success: false, message: 'CAPTCHA verification failed' });
    }

    // Check if user already exists
    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: 'User already exists' });
    }

    // Validate email and password
    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: 'Please enter a valid email' });
    }
    if (password.length < 8) {
      return res.json({ success: false, message: 'Please enter a strong password' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new userModel({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: 'user',
    });

    const user = await newUser.save();
    const token = createToken(user._id);

    // ✅ FIX: Removed duplicate `res.json()`, added `return`
    return res.json({ success: true, token, role: user.role });

  } catch (error) {
    console.log(error);

    // ✅ FIX: Check `res.headersSent` before sending another response
    if (!res.headersSent) {
      return res.json({ success: false, message: error.message });
    }
  }
};


// Route for admin login
// const adminLogin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
//       const token = jwt.sign(email + password, process.env.JWT_SECRET);
//       res.json({ success: true, token });
//     } else {
//       res.json({ success: false, message: 'Invalid credentials' });
//     }
//   } catch (error) {
//     console.log(error);
//     res.json({ success: false, message: error.message });
//   }
// };

// Function to fetch all users
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find(); // Find all users in the database
    res.json({ success: true, users }); // Send the users as the response
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: 'Failed to fetch users' });
  }
};

// Google login handler
// Google login handler
const googleLogin = async (req, res) => {
  const { token } = req.body; // Google token sent from the frontend

  try {
    if (!token) {
      return res.status(400).json({ success: false, message: 'Google token is required!' });
    }

    console.log("Received Google Token:", token);

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,  // The Google OAuth Client ID for your app
      
    });
    console.log("Received Token:", token);

    // Get payload and log it
    const payload = ticket.getPayload();
    console.log('Google Payload:', payload);  // Check the payload for debugging

    // Check the audience field
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      console.log('Audience mismatch! Expected:', process.env.GOOGLE_CLIENT_ID, 'but got:', payload.aud);
      return res.status(400).json({ success: false, message: 'Token audience mismatch' });
    }

    // Check if the user exists in the database
    let user = await userModel.findOne({ email: payload.email });

    // If the user doesn't exist, create a new user
    if (!user) {
      user = new userModel({
        firstName: payload.given_name,
        lastName: payload.family_name,
        email: payload.email,
        googleId: payload.sub,
        profilePicture: payload.picture,
        role: 'user',
      });
      await user.save(); // Save the new user to the database
    }

    // Create a JWT token for the user
    const authToken = createToken(user._id);

    // Send the JWT token as a response
    res.status(200).json({ success: true, token: authToken, role: user.role }); // ✅ Send role
  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(400).json({ success: false, message: 'Google login failed!' });
  }
};


export const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ success: true, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// Change User Role Controller
const changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params; // Get user ID from URL params
    const { role } = req.body; // Get the new role from request body
    const adminId = req.user.id; // Admin making the request

    // Ensure only an admin can change roles
    const admin = await userModel.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Ensure the user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Prevent admins from demoting themselves
    if (userId === adminId && role !== "admin") {
      return res.status(400).json({ success: false, message: "You cannot change your own role" });
    }

    // Update role in the database
    user.role = role;
    await user.save();

    res.json({ success: true, message: `User role updated to ${role}` });

  } catch (error) {
    console.error("Error changing user role:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};







export { loginUser, registerUser, getAllUsers, googleLogin, changeUserRole }; // Export the googleLogin function
