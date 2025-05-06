import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const authUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Get token from Authorization header

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: "Not Authorized, Please login again" 
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch the complete user record
    const user = await userModel.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Check if registration is complete (if phone was provided)
    if (user.tempPhone && !user.phoneVerified) {
      return res.status(403).json({
        success: false,
        message: "Phone verification required to complete registration",
        needsVerification: true,
        tempPhone: user.tempPhone
      });
    }

    // Attach user data to the request
    req.user = {
      id: user._id,
      email: user.email,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      role: user.role,
      registrationComplete: user.registrationComplete
    };

    next(); // Proceed to next middleware or route handler

  } catch (error) {
    console.error("🔴 Authentication error:", error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: "Session expired, please login again" 
      });
    }
    
    return res.status(403).json({ 
      success: false, 
      message: "Invalid or expired token" 
    });
  }
};

export default authUser;