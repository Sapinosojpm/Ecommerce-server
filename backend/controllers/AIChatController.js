import processChatMessage from "../utils/processChatMessage.js";


// AIChatController to handle the chat message
import AIChat from "../models/AIChatModel.js";

export const AIChatController = async (req, res) => {
  console.log("📩 Received Request at /api/chat");

  const { query } = req.body;
  if (!query) {
    console.log("❌ No query provided");
    return res.status(400).json({ response: "No query provided" });
  }

  try {
    console.log("✅ Query Received:", query);

    const response = await processChatMessage(query);
    console.log("✅ AI Response:", response);

    // Save to database
    const chat = new AIChat({ userMessage: query, aiResponse: response });
    await chat.save();
    console.log("💾 Chat Saved to Database");

    res.json({ response });
  } catch (error) {
    console.error("❌ Error in AIChatController:", error);
    res.status(500).json({ response: "An error occurred while processing your message." });
  }
};
