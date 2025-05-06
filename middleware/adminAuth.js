import jwt from "jsonwebtoken";
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

export default authUser;

