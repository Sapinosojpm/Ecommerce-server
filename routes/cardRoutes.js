import express from 'express';
import { addCard, listCards, removeCard, singleCard } from "../controllers/cardController.js";
import upload from '../middleware/multer.js';
import adminAuth from '../middleware/adminAuth.js';

const cardRouter = express.Router();

// Add a new card
cardRouter.post(
  '/addCard',
  adminAuth,  // Keep for authorization
  upload.fields([{ name: 'image', maxCount: 1 }]),
  addCard
);

// Delete a card
cardRouter.delete('/remove', adminAuth, removeCard);

// Get a single card by ID
cardRouter.post('/single', singleCard);

// Get a list of cards
cardRouter.get('/list', listCards);

export default cardRouter;
