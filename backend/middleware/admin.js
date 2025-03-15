import jwt from 'jsonwebtoken';

const authUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Get token from the Authorization header

  if (!token) {
    return res.json({ success: false, message: "Not Authorized, Please login again" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
    req.user = decoded; // Attach decoded token data to the request
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Invalid or expired token" });
  }
};


export default authUser;