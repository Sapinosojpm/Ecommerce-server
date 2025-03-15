import FAQ from "../models/FAQ.js";

// Create FAQ
export const createFAQ = async (req, res) => {
  const { question, answer } = req.body;
  try {
    const newFAQ = new FAQ({ question, answer });
    await newFAQ.save();
    res.status(201).json(newFAQ);
  } catch (error) {
    res.status(400).json({ message: "Error creating FAQ", error });
  }
};

// Get all FAQs
export const getFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find();
    res.status(200).json(faqs);
  } catch (error) {
    res.status(400).json({ message: "Error fetching FAQs", error });
  }
};

// Update FAQ
export const updateFAQ = async (req, res) => {
  const { id } = req.params;
  const { question, answer } = req.body;
  try {
    const updatedFAQ = await FAQ.findByIdAndUpdate(id, { question, answer }, { new: true });
    res.status(200).json(updatedFAQ);
  } catch (error) {
    res.status(400).json({ message: "Error updating FAQ", error });
  }
};

// Delete FAQ
export const deleteFAQ = async (req, res) => {
  const { id } = req.params;
  try {
    await FAQ.findByIdAndDelete(id);
    res.status(200).json({ message: "FAQ deleted" });
  } catch (error) {
    res.status(400).json({ message: "Error deleting FAQ", error });
  }
};
