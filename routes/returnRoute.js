import express from 'express';
import { 
  createReturn,
  processReturn,
  processRefund,
  getUserReturns,
  getReturnDetails,
  uploadReturnEvidence,
  checkReturnEligibility,
  checkReturnExists,  // Add this import
  getAdminReturns 
} from '../controllers/returnController.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import { upload } from '../config/uploadConfig.js';

const returnRouter = express.Router();

// Admin routes
returnRouter.get('/admin', adminAuth, getAdminReturns);
returnRouter.post('/:returnId/process', adminAuth, processReturn);
returnRouter.post('/:id/refund', adminAuth, processRefund);

// User routes
returnRouter.post('/', authUser, upload.array('images'), createReturn);
returnRouter.post('/:id/evidence', authUser, upload.single('images'), uploadReturnEvidence);
returnRouter.get('/user', authUser, getUserReturns);
returnRouter.get('/check-eligibility', authUser, checkReturnEligibility);
returnRouter.get('/check-return', authUser, checkReturnExists);  // Add this route
returnRouter.get('/:id', authUser, getReturnDetails);
returnRouter.post('/create-return', authUser, upload.array('images'), createReturn);

export default returnRouter;