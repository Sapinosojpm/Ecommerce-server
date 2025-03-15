import { v2 as cloudinary } from "cloudinary";
import cardModel from "../models/cardModel.js"; // Correct import

// Add a new card (name, description, image)
const addCard = async (req, res) => {
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
        const card = new cardModel({ name, description, image: imageUrl, date: Date.now() });
        await card.save();

        res.status(201).json({ success: true, message: "Card added successfully.", card });
    } catch (error) {
        console.error("Error adding card:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// List all cards
const listCards = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const cards = await cardModel
            .find({}, "name description image") // Fetch only required fields
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({ success: true, cards });
    } catch (error) {
        console.error("Error listing cards:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Remove a card by ID
const removeCard = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, message: "Card ID is required." });
        }

        const card = await cardModel.findById(id);
        if (!card) {
            return res.status(404).json({ success: false, message: "Card not found." });
        }

        await cardModel.findByIdAndDelete(id);

        res.json({ success: true, message: "Card removed successfully." });
    } catch (error) {
        console.error("Error removing card:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get a single card by ID
const singleCard = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, message: "Card ID is required." });
        }

        const card = await cardModel.findById(id, "name description image");
        if (!card) {
            return res.status(404).json({ success: false, message: "Card not found." });
        }

        res.json({ success: true, card });
    } catch (error) {
        console.error("Error fetching card:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};




export { listCards, addCard, removeCard, singleCard };
