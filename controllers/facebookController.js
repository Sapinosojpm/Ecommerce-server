import express from 'express';
import passport from '../facebookAuth.js';
import crypto from 'crypto';
import axios from 'axios';

// In-memory token store for Facebook access tokens
const fbTokenStore = new Map();

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

// Facebook OAuth start
const facebookAuth = passport.authenticate('facebook', { scope: ['email', 'pages_show_list', 'pages_read_engagement', 'pages_manage_posts'] });

// Facebook OAuth callback
const facebookCallback = [
  passport.authenticate('facebook', {
    failureRedirect: `${process.env.FRONTEND_URL}/facebook-manager?error=facebook_login_failed`,
    session: false
  }),
  (req, res) => {
    const fbAccessToken = req.user.accessToken;
    const token = crypto.randomBytes(32).toString('hex');
    fbTokenStore.set(token, fbAccessToken);
    res.redirect(`${process.env.FRONTEND_URL}/facebook-manager?token=${token}`);
  }
];

// Handle failed Facebook login gracefully
const facebookLoginError = (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/facebook-manager?error=facebook_login_failed`);
};

// Get Facebook pages
const getPages = [requireFBToken, async (req, res) => {
  try {
    const response = await axios.get(`https://graph.facebook.com/v18.0/me/accounts?access_token=${req.fbAccessToken}`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
}];

// Post to Facebook page
const postToPage = [requireFBToken, async (req, res) => {
  const { pageId, message, product } = req.body;
  try {
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
}];

export {
  facebookAuth,
  facebookCallback,
  facebookLoginError,
  getPages,
  postToPage
};
