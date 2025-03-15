import ShippingFee from "../models/WeightFeeModel.js";

// Get current fee per kilo
export const getFeePerKilo = async (req, res) => {
  try {
    const fee = await ShippingFee.findOne();
    res.json({ success: true, fee: fee?.perKilo || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching fee." });
  }
};

// Update fee per kilo
export const updateFeePerKilo = async (req, res) => {
  try {
    const { perKilo } = req.body;
    let fee = await ShippingFee.findOne();
    if (!fee) {
      fee = new ShippingFee({ perKilo });
    } else {
      fee.perKilo = perKilo;
    }
    await fee.save();
    res.json({ success: true, message: "Fee updated successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating fee." });
  }
};
