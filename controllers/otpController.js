import twilio from 'twilio';
import dotenv from 'dotenv';
import userModel from '../models/userModel.js';  // Ensure userModel is correctly imported
import { createToken } from './userController.js';  // Assuming this function generates the JWT token

dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const verifySid = process.env.TWILIO_VERIFY_SID;

// Mock OTP storage for development (for testing purposes)
const otpStorage = new Map();

// Send OTP function
export const sendOTP = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    // Development mode - mock OTP
    if (process.env.NODE_ENV !== 'production') {
      const mockOtp = '123456';
      otpStorage.set(phoneNumber, mockOtp);
      console.log(`[DEV] Mock OTP for ${phoneNumber}: ${mockOtp}`);
      return res.json({ 
        success: true, 
        status: 'development_mode',
        mockOtp
      });
    }

    // Production mode - real Twilio
    const verification = await client.verify.v2
      .services(verifySid)
      .verifications.create({ to: phoneNumber, channel: 'sms' });

    res.json({ success: true, status: verification.status });
  } catch (error) {
    console.error('OTP send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Verify OTP function
// In otpController.js
export const verifyOTP = async (req, res) => {
    const { phone, code, userId } = req.body;
  
    try {
      // 1. Verify the OTP code
      let verificationValid = false;
      
      // Development mode - mock verification
      if (process.env.NODE_ENV !== 'production') {
        verificationValid = code === '123456'; // Mock OTP code
        console.log(`[DEV] OTP Verification:`, { 
          phone, 
          code, 
          isValid: verificationValid 
        });
      } 
      // Production mode - real verification
      else {
        const verificationCheck = await client.verify.v2
          .services(verifySid)
          .verificationChecks.create({ to: phone, code });
        
        verificationValid = verificationCheck.status === 'approved';
      }
  
      if (!verificationValid) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid OTP code' 
        });
      }
  
      // 2. If OTP is valid, return success
      res.json({ 
        success: true,
        message: 'OTP verified successfully',
        userId: userId || verificationValid.userId // Ensure userId is always returned
      });
  
    } catch (error) {
      console.error('OTP verification failed:', error);
      res.status(500).json({ 
        success: false, 
        message: 'OTP verification failed',
        error: error.message 
      });
    }
  };