import Policy from '../models/policyModel.js';
import multer from 'multer';

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
    const { title, description } = req.body;
    const image = req.file ? `/uploads/policies/${req.file.filename}` : '';

    const newPolicy = new Policy({ title, description, image });
    await newPolicy.save();

    res.status(201).json(newPolicy);
  } catch (error) {
    res.status(500).json({ message: 'Error adding policy', error });
  }
};

// Update an existing policy
// Update a policy
export const updatePolicy = async (req, res) => {
  try {
    const { title, description } = req.body;
    const { id } = req.params;
    const policy = await Policy.findById(id);

    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    // Delete old image if a new image is uploaded
    if (req.file) {
      if (policy.image) {
        const oldImagePath = path.join('backend', policy.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      policy.image = `/uploads/policies/${req.file.filename}`;
    }

    policy.title = title || policy.title;
    policy.description = description || policy.description;
    
    await policy.save();
    res.json(policy);
  } catch (error) {
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
      const imagePath = path.join('backend', policy.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Policy.findByIdAndDelete(id);
    res.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete policy' });
  }
};