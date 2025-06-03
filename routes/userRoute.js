import express from 'express';
import { loginUser, registerUser, adminLogin, getAllUsers, googleLogin,changeUserRole,completeRegistration,finalizeRegistration,updateUserPermissions  } from '../controllers/userController.js';
import authUser from '../middleware/admin.js'; // Import the authUser middleware
import {  requestPasswordResetWithOTP,verifyResetOTP,resetPasswordAfterOTP,} from "../controllers/resetPasswordController.js";

const userRouter = express.Router();

// Register a new user
userRouter.post('/register', registerUser);

// Login a user
userRouter.post('/login', loginUser);

// Admin login
userRouter.post('/admin', adminLogin);

// Google login (OAuth)
userRouter.post('/google-login', googleLogin); // This route handles Google login

// Route to get all users (protected by the authUser middleware)
userRouter.get('/users', authUser, getAllUsers);

userRouter.put("/update-role/:userId", authUser, changeUserRole);


userRouter.post('/complete-registration', completeRegistration); // Finalize after OTP
userRouter.post('/finalize-registration', finalizeRegistration);

userRouter.post('/request-password-reset-otp', requestPasswordResetWithOTP);
userRouter.post('/verify-reset-otp', verifyResetOTP);
userRouter.post('/reset-password', resetPasswordAfterOTP);

userRouter.put('/update-permissions/:userId', authUser, updateUserPermissions);
// userRouter.post('/api/user/google-login', googleLogin); // Define the POST route for Google login
export default userRouter;
