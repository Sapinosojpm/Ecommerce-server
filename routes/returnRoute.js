import express from 'express';
import { 
  createReturn,
  processReturn,
  processRefund,
  getUserReturns,
  getReturnDetails,
  uploadReturnEvidence
} from '../controllers/returnController.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import { upload } from '../config/uploadConfig.js';

const returnRouter = express.Router();

// User routes
returnRouter.post('/', authUser, createReturn);
returnRouter.get('/user', authUser, getUserReturns);
returnRouter.get('/:id', authUser, getReturnDetails);
returnRouter.post('/:id/evidence', authUser, upload.single('evidence'), uploadReturnEvidence);

// Admin routes
returnRouter.post('/:id/process', adminAuth, processReturn);
returnRouter.post('/:id/refund', adminAuth, processRefund);

export default returnRouter;