import express from 'express';
import { addMemberCard, listMemberCards, removeMemberCard, singleMemberCard } from "../controllers/memberCardController.js";
import upload from '../middleware/multer.js';
import adminAuth from '../middleware/adminAuth.js';

const memberCardRouter = express.Router();

// Add a new card
memberCardRouter.post(
  '/addMemberCard',
  adminAuth,  // Keep for authorization
  upload.fields([{ name: 'image', maxCount: 1 }]),
  addMemberCard
);

// Delete a card
memberCardRouter.delete('/remove', adminAuth, removeMemberCard);

// Get a single card by ID
memberCardRouter.post('/single', singleMemberCard);

// Get a list of cards
memberCardRouter.get('/list', listMemberCards);

export default memberCardRouter;
