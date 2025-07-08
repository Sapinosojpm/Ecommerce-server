import express from 'express';
import passport from '../facebookAuth.js';
import crypto from 'crypto';
import axios from 'axios';
import FbToken from '../models/fbTokenModel.js';

// Middleware to require and validate token, set req.fbAccessToken
async function requireFBToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = auth.split(' ')[1];
  try {
    const fbTokenDoc = await FbToken.findOne({ token });
    if (!fbTokenDoc) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.fbAccessToken = fbTokenDoc.fbAccessToken;
    req.fbUserId = fbTokenDoc.userId;
    next();
  } catch (err) {
    console.error('[requireFBToken] Error validating token:', err);
    return res.status(500).json({ error: 'Token validation error' });
  }
}

// Facebook Auth request logger
function logFacebookAuthRequest(req, res, next) {
  console.log(`[FB AUTH] ${req.method} ${req.originalUrl}`);
  next();
}

// Facebook OAuth start
const facebookAuth = passport.authenticate('facebook', { scope: ['email', 'pages_show_list', 'pages_read_engagement', 'pages_manage_posts'] });

// Stateless Facebook OAuth callback (no Passport, no session)
const facebookCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect(`${process.env.FRONTEND_URL}/facebook-manager?error=missing_code`);

  try {
    // 1. Exchange code for access token
    const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: process.env.FACEBOOK_CALLBACK_URL,
        code,
      }
    });
    const fbAccessToken = tokenRes.data.access_token;

    // 2. Fetch user profile
    const profileRes = await axios.get('https://graph.facebook.com/me', {
      params: {
        access_token: fbAccessToken,
        fields: 'id,name,email'
      }
    });
    const user = profileRes.data;

    // 3. Generate your own token and save to DB
    const token = crypto.randomBytes(32).toString('hex');
    await FbToken.create({ token, fbAccessToken, userId: user.id });

    // 4. Redirect to frontend with your token (to a special close page for popup handling)
    res.redirect(`${process.env.FRONTEND_URL}/facebook-oauth-close?token=${token}`);
  } catch (err) {
    console.error('[FB CALLBACK] Error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/facebook-manager?error=facebook_login_failed`);
  }
};

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
