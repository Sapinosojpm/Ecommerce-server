import express from 'express';
import { loginUser, registerUser, adminLogin, getAllUsers, changeUserRole, completeRegistration, updateUserPermissions, finalizeRegistration } from '../controllers/userController.js';
import { requestPasswordResetWithOTP, verifyResetOTP, resetPasswordAfterOTP } from "../controllers/resetPasswordController.js";
import authUser from '../middleware/adminAuth.js';

const userRouter = express.Router();

// Register a new user
userRouter.post('/register', registerUser);

// Login a user
userRouter.post('/login', loginUser);

// Admin login
userRouter.post('/admin', adminLogin);

// Route to get all users (protected by the authUser middleware)
userRouter.get('/users', authUser, getAllUsers);

userRouter.put("/update-role/:userId", authUser, changeUserRole);

userRouter.post('/complete-registration', completeRegistration); // Finalize after OTP
userRouter.post('/finalize-registration', finalizeRegistration);

userRouter.post('/request-password-reset-otp', requestPasswordResetWithOTP);
userRouter.post('/verify-reset-otp', verifyResetOTP);
userRouter.post('/reset-password', resetPasswordAfterOTP);

userRouter.put('/update-permissions/:userId', authUser, updateUserPermissions);

export default userRouter;
