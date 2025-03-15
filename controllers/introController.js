import { v2 as cloudinary } from "cloudinary";
import introModel from "../models/introModel.js"; // Correct import

// Add a new intro (name, description, image)
const addIntro = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).json({ success: false, message: "Name and description are required." });
        }

        const image = req.files?.image?.[0];
        const video = req.files?.video?.[0]; // Capture the video file
        let imageUrl = "";
        let videoUrl = "";

        // Upload image if provided
        if (image) {
            try {
                const result = await cloudinary.uploader.upload(image.path, { resource_type: "image" });
                imageUrl = result.secure_url;
            } catch (error) {
                console.error("Image upload failed:", error);
                return res.status(500).json({ success: false, message: "Image upload failed." });
            }
        }

        // Upload video if provided
        if (video) {
            try {
                const result = await cloudinary.uploader.upload(video.path, { resource_type: "video" });
                videoUrl = result.secure_url;
            } catch (error) {
                console.error("Video upload failed:", error);
                return res.status(500).json({ success: false, message: "Video upload failed." });
            }
        }

        // Create and save intro
        const intro = new introModel({ name, description, image: imageUrl, video: videoUrl, date: Date.now() });
        await intro.save();

        res.status(201).json({ success: true, message: "Intro added successfully.", intro });
    } catch (error) {
        console.error("Error adding intro:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


// List all intros
const listIntros = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const intros = await introModel
            .find({}, "name description image") // Fetch only required fields
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .lean(); // Convert Mongoose objects to plain JavaScript objects

        // Transform the _id field to string and date to number
        const transformedIntros = intros.map(intro => ({
            _id: intro._id.toString(), // Convert ObjectId to string
            name: intro.name,
            description: intro.description,
            image: intro.image,
            date: intro.date, // Ensure this is converted as needed (e.g., using Date() if needed)
        }));

        res.json({ success: true, intros: transformedIntros });

    } catch (error) {
        console.error("Error listing intros:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


// Remove an intro by ID
const removeIntro = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, message: "Intro ID is required." });
        }

        const intro = await introModel.findById(id);
        if (!intro) {
            return res.status(404).json({ success: false, message: "Intro not found." });
        }

        await introModel.findByIdAndDelete(id);

        res.json({ success: true, message: "Intro removed successfully." });
    } catch (error) {
        console.error("Error removing intro:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get a single intro by ID
const singleIntro = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, message: "Intro ID is required." });
        }

        const intro = await introModel.findById(id, "name description image");
        if (!intro) {
            return res.status(404).json({ success: false, message: "Intro not found." });
        }

        res.json({ success: true, intro });
    } catch (error) {
        console.error("Error fetching intro:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};



export { listIntros, addIntro, removeIntro, singleIntro };
