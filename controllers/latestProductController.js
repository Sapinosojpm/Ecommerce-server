import LatestProductSetting from "../models/LatestProductSetting.js";

// Get Latest Product Display Limit
export const getLatestProductSetting = async (req, res) => {
    try {
        const setting = await LatestProductSetting.findOne();
        res.json(setting || { maxDisplay: 10 }); // Default to 10 if not found
    } catch (error) {
        res.status(500).json({ message: "Error fetching latest product setting" });
    }
};

// Update Latest Product Display Limit
export const updateLatestProductSetting = async (req, res) => {
    try {
        const { maxDisplay } = req.body;

        let setting = await LatestProductSetting.findOne();
        if (!setting) {
            setting = new LatestProductSetting({ maxDisplay });
        } else {
            setting.maxDisplay = maxDisplay;
        }
        
        await setting.save();
        res.json({ message: "Latest product display limit updated", maxDisplay });
    } catch (error) {
        res.status(500).json({ message: "Error updating latest product setting" });
    }
};
