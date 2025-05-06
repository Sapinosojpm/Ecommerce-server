import express from 'express';
import { sendOTP, verifyOTP } from '../controllers/otpController.js';

const router = express.Router();

router.post('/send-otp', sendOTP);
router.post('/verify-otp', (req, res) => {
    console.log("hit", req.body);  // This will log when the route is hit
    verifyOTP(req, res);  // Proceed to the verifyOTP function
  });
  
// Remove this line if you don't need registration verification
// router.post('/verify-registration', verifyRegistrationOTP);

export default router;