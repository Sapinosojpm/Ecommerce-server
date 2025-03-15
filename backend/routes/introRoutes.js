import express from 'express';
import { addIntro, listIntros, removeIntro, singleIntro } from "../controllers/introController.js";
import {upload} from '../middleware/upload.js';
import adminAuth from '../middleware/adminAuth.js';

const introRouter = express.Router();

// Add a new intro
introRouter.post(
  '/addIntro',
  adminAuth,  // Keep for authorization
  upload.fields([{ name: 'image', maxCount: 1 }]),
  addIntro
);

// Delete an intro
introRouter.delete('/remove', adminAuth, removeIntro);

// Get a single intro by ID
introRouter.post('/single', singleIntro);

// Get a list of intros
introRouter.get('/list', listIntros);

introRouter.post('/addIntro',adminAuth, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), addIntro);


export default introRouter;
