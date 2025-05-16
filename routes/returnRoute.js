import express from 'express';
import { 
  createReturn,
  processReturn,
  processRefund,
  getUserReturns,
  getReturnDetails,
  uploadReturnEvidence,
  checkReturnEligibility,
  getAdminReturns 
} from '../controllers/returnController.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import { upload } from '../config/uploadConfig.js';

const returnRouter = express.Router();

// User routes
returnRouter.post('/', authUser, upload.array('images'), createReturn);
returnRouter.post('/:id/evidence', authUser, upload.single('images'), uploadReturnEvidence);
returnRouter.get('/user', authUser, getUserReturns);
returnRouter.get('/check-eligibility', authUser, checkReturnEligibility);
returnRouter.get('/:id', authUser, getReturnDetails)
returnRouter.post('/create-return', authUser, upload.array('images'), createReturn);

// Admin routes
returnRouter.get('/admin', adminAuth, getAdminReturns); // Add this route
returnRouter.post('/:id/process', adminAuth, processReturn);
returnRouter.post('/:id/refund', adminAuth, processRefund);

export default returnRouter;