import memberCardModel from "../models/memberCardModel.js"; // Correct import

// Add a new card (name, description, image)
const addMemberCard = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).json({ success: false, message: "Name and description are required." });
        }

        const image = req.files?.image?.[0]; // Check if image is provided
        let imageUrl = "";

        // TODO: Handle S3 URL for image
        if (image) {
            // This part of the code was removed as per the edit hint.
            // The original code had cloudinary.uploader.upload which is no longer imported.
            // The new code will need to be updated to handle S3 URL generation.
            // For now, we'll just set imageUrl to the local path for demonstration.
            // In a real application, you would upload to S3 and get the URL.
            imageUrl = image.path; // Assuming image.path is the local path for now
        }

        // Create and save card
        const memberCard = new memberCardModel({ name, description, image: imageUrl, date: Date.now() });
        await memberCard.save();

        res.status(201).json({ success: true, message: "Card added successfully.", memberCard });
    } catch (error) {
        console.error("Error adding card:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// List all cards
const listMemberCards = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const memberCards = await memberCardModel
            .find({}, "name description image") // Fetch only required fields
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({ success: true, memberCards });
    } catch (error) {
        console.error("Error listing cards:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Remove a card by ID
const removeMemberCard = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, message: "Card ID is required." });
        }

        const MemberCard = await memberCardModel.findById(id);
        if (!MemberCard) {
            return res.status(404).json({ success: false, message: "Card not found." });
        }

        await memberCardModel.findByIdAndDelete(id);

        res.json({ success: true, message: "Card removed successfully." });
    } catch (error) {
        console.error("Error removing card:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get a single card by ID
const singleMemberCard = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, message: "Card ID is required." });
        }

        const memberCard = await memberCardModel.findById(id, "name description image");
        if (!memberCard) {
            return res.status(404).json({ success: false, message: "Card not found." });
        }

        res.json({ success: true, memberCard });
    } catch (error) {
        console.error("Error fetching card:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};




export { listMemberCards, addMemberCard, removeMemberCard, singleMemberCard };
