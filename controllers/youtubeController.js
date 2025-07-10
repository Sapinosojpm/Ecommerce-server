import { Youtube } from "../models/youtubeModel.js";

// GET: Retrieve the current video URL (YouTube or local)
export const getYoutubeUrlController = async (req, res) => {
  try {
    let youtubeSetting = await Youtube.findOne({});
    if (!youtubeSetting) {
      youtubeSetting = await Youtube.create({ url: "https://www.youtube.com/embed/default" });
    }
    res.json({ youtubeUrl: youtubeSetting.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST: Update the YouTube URL
export const updateYoutubeUrlController = async (req, res) => {
  const { newUrl } = req.body;
  if (!newUrl) {
    return res.status(400).json({ message: "No URL provided" });
  }
  try {
    let youtubeSetting = await Youtube.findOne({});
    if (!youtubeSetting) {
      youtubeSetting = await Youtube.create({ url: newUrl });
    } else {
      youtubeSetting.url = newUrl;
      await youtubeSetting.save();
    }
    res.json({ message: "YouTube URL updated successfully", youtubeUrl: youtubeSetting.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST: Upload a local video and update the database
export const uploadLocalVideoController = async (req, res) => {
  const { videoUrl } = req.body;
  if (!videoUrl) {
    return res.status(400).json({ success: false, message: "No video URL provided." });
  }
  try {
    let youtubeSetting = await Youtube.findOne({});
    if (!youtubeSetting) {
      youtubeSetting = await Youtube.create({ url: videoUrl });
    } else {
      youtubeSetting.url = videoUrl;
      await youtubeSetting.save();
    }
    res.json({ success: true, message: "Video uploaded successfully!", videoUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
