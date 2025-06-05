import jwt from 'jsonwebtoken';

const authUser = async (req, res, next) => {
    let token = req.headers.token || req.headers['authorization'];

    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not Authorized. Please log in again.' });
    }

    try {
        const token_decode = jwt.verify(token, process.env.JWT_SECRET);
        req.userEmail = token_decode.email;
        req.userId = token_decode.id;  // Fix here
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
    }
};


export default authUser;
