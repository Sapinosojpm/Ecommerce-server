import express from 'express';
import multer from 'multer';
import { getPolicies, addPolicy, updatePolicy, deletePolicy } from '../controllers/policyController.js';

const router = express.Router();

// ✅ Define `multer` storage **inside** this file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/policies/'); // Make sure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// ✅ Use `upload` directly in routes
router.get('/', getPolicies);
router.post('/', addPolicy);
router.put('/:id', updatePolicy);
router.delete('/:id', deletePolicy);

export default router;
