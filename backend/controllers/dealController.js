// controllers/dealController.js
import Deal from '../models/dealModel.js';

// Create a new deal
export const createDeal = async (req, res) => {
  const { title, description, discount, imageUrl, active } = req.body;

  try {
    const deal = new Deal({ title, description, discount, imageUrl, active });
    await deal.save();
    res.status(201).json(deal);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create deal' });
  }
};

// Get all deals
export const getAllDeals = async (req, res) => {
  try {
    const deals = await Deal.find();
    res.status(200).json(deals);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deals' });
  }
};

// Get a deal by ID
export const getDealById = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ message: 'Deal not found' });
    res.status(200).json(deal);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deal' });
  }
};

// Update a deal
export const updateDeal = async (req, res) => {
  const { title, description, discount, imageUrl, active } = req.body;

  try {
    const deal = await Deal.findByIdAndUpdate(
      req.params.id,
      { title, description, discount, imageUrl, active },
      { new: true }
    );
    if (!deal) return res.status(404).json({ message: 'Deal not found' });
    res.status(200).json(deal);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update deal' });
  }
};

// Delete a deal
export const deleteDeal = async (req, res) => {
  try {
    const deal = await Deal.findByIdAndDelete(req.params.id);
    if (!deal) return res.status(404).json({ message: 'Deal not found' });
    res.status(200).json({ message: 'Deal deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete deal' });
  }
};
