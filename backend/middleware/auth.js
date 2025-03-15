import jwt from 'jsonwebtoken';

const authUser = async (req, res, next) => {
    let token = req.headers.token || req.headers['authorization'];

    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7, token.length); // Remove "Bearer " prefix
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not Authorized. Please log in again.' });
    }

    try {
        const token_decode = jwt.verify(token, process.env.JWT_SECRET);
        req.userEmail = token_decode.email; // Extract user email from token
        req.body.userId = token_decode.id;  // Extract user ID from token
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
    }
};

export default authUser;
