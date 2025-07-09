import express from 'express';
import {
  facebookAuth,
  facebookCallback,
  facebookLoginError,
  getPages,
  postToPage,
  getFBAccessToken
} from '../controllers/facebookController.js';

const router = express.Router();

// Facebook OAuth start
router.get('/auth/facebook', facebookAuth);
// Facebook OAuth callback
router.get('/auth/facebook/callback', facebookCallback);
// Facebook login error
router.get('/login', facebookLoginError);
// Facebook API endpoints
router.get('/facebook/pages', getPages);
router.post('/facebook/post', postToPage);
// Secure endpoint to get fbAccessToken (for debugging only)
router.get('/facebook/fb-access-token', getFBAccessToken);
// Catch-all error handler for /facebook/* routes to always return JSON
router.use('/facebook/*', (req, res) => {
  res.status(404).json({ error: 'Facebook API endpoint not found' });
});

export default router;
