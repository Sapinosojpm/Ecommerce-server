import jwt from "jsonwebtoken";
import multer from "multer";
// authUser.js (middleware)
const authUser = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        console.log("Extracted Token:", token); // Log the token for debugging

        if (!token) {
            return res.status(401).json({ success: false, message: "Not Authorized. Login Again" });
        }

        const token_decode = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded Token:", token_decode); // Log decoded token

        // Attach user info from token to request
        req.user = token_decode; // You should access it as req.user
        console.log("✅ User ID from token:", req.user.id); // Log user ID from token

        next();
    } catch (error) {
        console.log("Auth Error:", error);
        return res.status(401).json({ success: false, message: "Invalid or Expired Token" });
    }
};

// Protect Middleware – for any logged-in user
export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Not Authorized. Login Again" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or Expired Token" });
  }
};
export const admin = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access only" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export default authUser;

