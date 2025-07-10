import Policy from '../models/policyModel.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/policies/'); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Fetch all policies
export const getPolicies = async (req, res) => {
  try {
    const policies = await Policy.find();
    res.status(200).json(policies);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching policies', error });
  }
};

// Add a new policy
export const addPolicy = async (req, res) => {
  try {
    const { title, description, image } = req.body;
    const imageUrl = (typeof image === 'string' && image.startsWith('https://')) ? image : '';
    const newPolicy = new Policy({ title, description, image: imageUrl });
    await newPolicy.save();
    res.status(201).json(newPolicy);
  } catch (error) {
    res.status(500).json({ message: 'Error adding policy', error });
  }
};

// Update an existing policy
export const updatePolicy = async (req, res) => {
  try {
    const { title, description, image } = req.body;
    const { id } = req.params;
    const policy = await Policy.findById(id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    if (typeof image === 'string' && image.startsWith('https://')) {
      policy.image = image;
    }
    policy.title = title || policy.title;
    policy.description = description || policy.description;
    await policy.save();
    res.json(policy);
  } catch (error) {
    console.error('Error updating policy:', error);
    res.status(500).json({ error: 'Failed to update policy' });
  }
};

// Delete a policy
export const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await Policy.findById(id);

    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    // Remove image file
    if (policy.image) {
      const imagePath = path.join(process.cwd(), 'Ecommerce-server', policy.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Policy.findByIdAndDelete(id);
    res.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting policy:', error);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
};