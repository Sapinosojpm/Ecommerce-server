import Discount from "../models/adminDiscount.js";

// ✅ Get the latest discount
export const getDiscount = async (req, res) => {
  try {
    const discount = await Discount.findOne().sort({ _id: -1 }); // Get the most recent discount
    if (!discount) {
      return res.status(404).json({ message: "No discount found" });
    }
    res.status(200).json(discount);
  } catch (error) {
    console.error("Error fetching discount:", error);
    res.status(500).json({ message: "Failed to fetch discount" });
  }
};

// ✅ Create a new discount
export const createDiscount = async (req, res) => {
  try {
    console.log("Request Body:", req.body); // Debugging: Log request body

    const { discountCode, discountPercent } = req.body;

    if (!discountCode || !discountPercent) {
      return res.status(400).json({ message: "Both discount code and percentage are required." });
    }

    // Ensure discountPercent is a valid number
    if (isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      return res.status(400).json({ message: "Discount percentage must be a number between 1 and 100." });
    }

    // Check if the discount code already exists
    const existingDiscount = await Discount.findOne({ discountCode });
    if (existingDiscount) {
      return res.status(400).json({ message: "This discount code already exists. Choose a different one." });
    }

    const newDiscount = new Discount({ discountCode, discountPercent });
    await newDiscount.save();

    res.status(201).json({ message: "Discount created successfully!", discount: newDiscount });
  } catch (error) {
    console.error("Error creating discount:", error);
    res.status(500).json({ message: "Failed to create discount" });
  }
};

// ✅ Update an existing discount
export const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const { discountCode, discountPercent } = req.body;

    if (!discountCode || !discountPercent) {
      return res.status(400).json({ message: "Both discount code and percentage are required." });
    }

    const updatedDiscount = await Discount.findByIdAndUpdate(
      id,
      { discountCode, discountPercent },
      { new: true, runValidators: true } // Ensure validation is applied
    );

    if (!updatedDiscount) {
      return res.status(404).json({ message: "Discount not found" });
    }

    res.json({ message: "Discount updated successfully", discount: updatedDiscount });
  } catch (error) {
    console.error("Error updating discount:", error);
    res.status(500).json({ message: "Failed to update discount" });
  }
};

// ✅ Delete a discount
export const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedDiscount = await Discount.findByIdAndDelete(id);

    if (!deletedDiscount) {
      return res.status(404).json({ message: "Discount not found" });
    }

    res.json({ message: "Discount deleted successfully" });
  } catch (error) {
    console.error("Error deleting discount:", error);
    res.status(500).json({ message: "Failed to delete discount" });
  }
};
