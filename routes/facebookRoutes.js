import express from 'express';
import {
  facebookAuth,
  facebookCallback,
  facebookLoginError,
  getPages,
  postToPage
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

export default router;
