import { v2 as cloudinary } from "cloudinary";
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

        if (image) {
            try {
                const result = await cloudinary.uploader.upload(image.path, { resource_type: "image" });
                imageUrl = result.secure_url;
            } catch (error) {
                console.error("Image upload failed:", error);
                return res.status(500).json({ success: false, message: "Image upload failed." });
            }
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
