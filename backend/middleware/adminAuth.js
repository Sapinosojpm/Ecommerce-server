import jwt from "jsonwebtoken";

const authUser = async (req, res, next) => {
    try {
        // Extract token correctly
        
        const token = req.headers.authorization?.split(" ")[1];
        console.log("Extracted Token:", token); // ✅ Log the token


        if (!token) {
            return res.status(401).json({ success: false, message: "Not Authorized. Login Again" });
        }

        // Verify token
        const token_decode = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded Token:", token_decode); // ✅ Log decoded token
        // Attach decoded token to request
        req.user = token_decode;
         console.log("✅ User ID from token:", req.user.id); // ✅ Log extracted user ID
        next();
    } catch (error) {
        console.log("Auth Error:", error);
        return res.status(401).json({ success: false, message: "Invalid or Expired Token" });
    }
};

export default authUser;
