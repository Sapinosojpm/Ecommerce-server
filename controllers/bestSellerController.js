import BestSellerSetting from "../models/BestSellerSetting.js";

// Get Best Seller Display Limit
export const getBestSellerSetting = async (req, res) => {
    try {
        const setting = await BestSellerSetting.findOne();
        res.json(setting || { maxDisplay: 10 }); // Default to 10 if not found
    } catch (error) {
        res.status(500).json({ message: "Error fetching best seller setting" });
    }
};

// Update Best Seller Display Limit
export const updateBestSellerSetting = async (req, res) => {
    try {
        const { maxDisplay } = req.body;
        let setting = await BestSellerSetting.findOne();
        
        if (!setting) {
            setting = new BestSellerSetting({ maxDisplay });
        } else {
            setting.maxDisplay = maxDisplay;
        }

        await setting.save();
        res.json({ message: "Best seller display updated", setting });
    } catch (error) {
        res.status(500).json({ message: "Error updating best seller setting" });
    }
};
