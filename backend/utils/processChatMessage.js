import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

console.log("Loaded OpenAI API Key:", process.env.OPENAI_API_KEY ? "✅ Present" : "❌ Missing");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// console.log("OpenAI API Key: ", process.env.OPENAI_API_KEY);

const processChatMessage = async (query) => {
  try {
    console.log("🔵 Sending request to OpenAI:", query);

    // Use GPT-3.5 (free tier) instead of GPT-4
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use GPT-3.5 for free users
      messages: [{ role: "user", content: query }],
    });

    console.log("🟢 OpenAI Raw Response:", response);

    if (!response.choices || response.choices.length === 0) {
      throw new Error("No AI response received.");
    }

    const aiResponse = response.choices[0]?.message?.content || "No AI response";
    console.log("✅ AI Response:", aiResponse);

    return aiResponse;
  } catch (error) {
    console.error("❌ OpenAI Error:", error);

    if (error.response) {
      console.error("📢 API Response Error:", error.response.data);
      return `Error: ${error.response.data.error.message || "Unknown API error"}`;
    }

    return "Error: Failed to connect to OpenAI API.";
  }
};

export default processChatMessage;
