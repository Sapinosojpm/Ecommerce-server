import crypto from 'crypto';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// STEP 1: Request OTP
export const requestPasswordResetWithOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = Date.now() + 15 * 60 * 1000; // 15 mins

    user.resetEmailOTP = otp;
    user.resetEmailOTPExpires = otpExpires;
    user.isOTPVerified = false;
    await user.save();

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: 'Password Reset OTP',
      html: `
        <p>You requested a password reset.</p>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
      email: user.email,
    });
  } catch (error) {
    console.error('OTP request error:', error);
    res.status(500).json({ success: false, message: 'Error processing OTP request' });
  }
};

// STEP 2: Verify OTP
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.resetEmailOTP !== otp || user.resetEmailOTPExpires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.isOTPVerified = true;
    await user.save();

    res.status(200).json({ success: true, message: 'OTP verified' });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ success: false, message: 'Error verifying OTP' });
  }
};

// STEP 3: Reset Password
export const resetPasswordAfterOTP = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email });

    if (!user || !user.isOTPVerified) {
      return res.status(400).json({
        success: false,
        message: 'OTP not verified or user not found',
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.resetEmailOTP = undefined;
    user.resetEmailOTPExpires = undefined;
    user.isOTPVerified = undefined;

    await user.save();

    res.status(200).json({ success: true, message: 'Password successfully reset' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, message: 'Error resetting password' });
  }
};
