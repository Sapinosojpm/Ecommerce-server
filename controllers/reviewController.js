import Review from "../models/reviewModel.js";

// Controller to fetch all website reviews
export const getReviews = async (req, res) => {
  try {
    const reviews = await Review.find(); // Fetch all reviews
    res.json({ success: true, reviews });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
};

// Controller to add a new website review
export const addReview = async (req, res) => {
  try {
    const { name, rating, review } = req.body;

    if (!name || !rating || !review) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const newReview = new Review({ name, rating, review });
    const savedReview = await newReview.save();

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      review: savedReview,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete one or many reviews by IDs
export const deleteReviews = async (req, res) => {
  try {
    const { ids } = req.body; // Expecting array of review IDs to delete

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No review IDs provided" });
    }

    const result = await Review.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `${result.deletedCount} review(s) deleted` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete reviews" });
  }
};
