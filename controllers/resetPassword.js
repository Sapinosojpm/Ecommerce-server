import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import userModel from '../models/userModel.js'; // Ensure this is correct

// Route to initiate password reset (send reset link)
const initiateResetPassword = async (req, res) => {
  try {
    const { email, backendUrl } = req.body;  // Accepting backendUrl from the request

    // Check if the user exists
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User doesn't exist" });
    }

    // Generate a reset token (expires in 15 minutes)
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });

    // Create the reset link using the passed backendUrl
    const resetLink = `${backendUrl}/reset-password/${resetToken}`;

    // Set up nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      debug: true,  // Enable debugging to check if the email is being sent
    });

    // Configure email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset',
      html: `<p>Click the link below to reset your password:</p>
             <p><a href="${resetLink}">${resetLink}</a></p>
             <p>This link will expire in 15 minutes.</p>`,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully to:', email);
    res.json({ success: true, message: 'Password reset link sent to your email' });

  } catch (error) {
    console.log('Error while sending password reset email:', error);
    res.json({ success: false, message: 'Something went wrong' });
  }
};

// Route to update the password (after verifying token)
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify the reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if the user exists
    const user = await userModel.findById(decoded.id);
    if (!user) {
      return res.json({ success: false, message: "User doesn't exist" });
    }

    // Validate the new password
    if (newPassword.length < 8) {
      return res.json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the user's password
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.log('Error while resetting password:', error);
    res.json({ success: false, message: 'Invalid or expired token' });
  }
};

// Exporting the functions
export { initiateResetPassword, resetPassword };
