import express from 'express';
import passport from '../facebookAuth.js';
import crypto from 'crypto';
import axios from 'axios';
import FbToken from '../models/fbTokenModel.js';

// Middleware to require and validate token, set req.fbAccessToken
async function requireFBToken(req, res, next) {
  const auth = req.headers.authorization;
  console.log('[requireFBToken] Authorization header:', auth);
  if (!auth || !auth.startsWith('Bearer ')) {
    console.log('[requireFBToken] No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = auth.split(' ')[1];
  try {
    const fbTokenDoc = await FbToken.findOne({ token });
    console.log('[requireFBToken] Token lookup result:', fbTokenDoc);
    if (!fbTokenDoc) {
      console.log('[requireFBToken] Invalid or expired token');
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
  console.log('[FB CALLBACK] Callback hit. Query:', req.query);
  if (!code) {
    console.log('[FB CALLBACK] Missing code in query');
    return res.redirect(`${process.env.FRONTEND_URL}/facebook-manager?error=missing_code`);
  }

  try {
    // 1. Exchange code for access token
    console.log('[FB CALLBACK] Exchanging code for access token...');
    const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: process.env.FACEBOOK_CALLBACK_URL,
        code,
      }
    });
    const fbAccessToken = tokenRes.data.access_token;
    console.log('[FB CALLBACK] Got fbAccessToken:', fbAccessToken);

    // 2. Fetch user profile
    console.log('[FB CALLBACK] Fetching user profile...');
    const profileRes = await axios.get('https://graph.facebook.com/me', {
      params: {
        access_token: fbAccessToken,
        fields: 'id,name,email'
      }
    });
    const user = profileRes.data;
    console.log('[FB CALLBACK] Got user profile:', user);

    // 3. Generate your own token and save to DB (update if user already exists)
    const token = crypto.randomBytes(32).toString('hex');
    try {
      const existing = await FbToken.findOne({ userId: user.id });
      if (existing) {
        existing.token = token;
        existing.fbAccessToken = fbAccessToken;
        await existing.save();
        console.log(`[FB CALLBACK] Updated token for user ${user.id}`);
      } else {
        await FbToken.create({ token, fbAccessToken, userId: user.id });
        console.log(`[FB CALLBACK] Created new token for user ${user.id}`);
      }
    } catch (dbErr) {
      console.error('[FB CALLBACK] Error saving token to DB:', dbErr);
      return res.redirect(`${process.env.FRONTEND_URL}/facebook-manager?error=db_save_failed`);
    }

    // 4. Redirect to frontend with your token
    console.log('[FB CALLBACK] Redirecting to frontend with token:', token);
    res.redirect(`${process.env.FRONTEND_URL}/facebook-manager?token=${token}`);
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
  console.log('[getPages] Called for user:', req.fbUserId);
  try {
    const response = await axios.get(`https://graph.facebook.com/v18.0/me/accounts?access_token=${req.fbAccessToken}`);
    console.log('[getPages] Facebook API response:', response.data);
    res.json(response.data);
  } catch (err) {
    console.error('[getPages] Error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
}];

// Post to Facebook page
const postToPage = [requireFBToken, async (req, res) => {
  const { pageId, message, product } = req.body;
  console.log('[postToPage] Called with:', { pageId, message, product, userId: req.fbUserId });
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
    console.log('[postToPage] Facebook post response:', fbResponse.data);
    res.json(fbResponse.data);
  } catch (err) {
    console.error('[postToPage] Error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
}];

// Secure endpoint to get fbAccessToken for authenticated user (for debugging only)
const getFBAccessToken = [requireFBToken, async (req, res) => {
  try {
    res.json({ fbAccessToken: req.fbAccessToken });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get fbAccessToken' });
  }
}];

export {
  facebookAuth,
  facebookCallback,
  facebookLoginError,
  getPages,
  postToPage,
  getFBAccessToken
};
