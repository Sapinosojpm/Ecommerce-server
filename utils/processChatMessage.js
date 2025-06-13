import OpenAI from "openai";
import dotenv from "dotenv";
import mongoose from "mongoose";
import productModel from "../models/productModel.js";
import AIChatModel from "../models/AIChatModel.js";
import ProductReview from "../models/ProductReview.js";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log("OpenAI API Key Check:", process.env.OPENAI_API_KEY ? "✅ Present" : "❌ Missing");

const getWelcomeMessage = () => {
  return `Hello! Welcome to our store.  
I'm here to help you find products, check prices, and answer your questions.  
Just type what you're looking for, and I'll assist you.`;
};

const fixSpelling = async (query) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Fix only spelling errors while preserving the original language. Return only the corrected text.",
        },
        { role: "user", content: query },
      ],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content.trim() || query;
  } catch (error) {
    console.error("Spelling correction error:", error);
    return query;
  }
};

const extractKeywords = (query) => {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .split(" ")
    .filter(word => word.length > 2);
};

const fetchAdditionalProductInfo = async (productName) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Provide product specifications, features, and reviews based on the product name."
        },
        { role: "user", content: `Tell me more about ${productName}.` }
      ],
      temperature: 0.5
    });

    return response.choices[0]?.message?.content.trim() || "No additional details found.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "Additional details not available at the moment.";
  }
};


const searchProducts = async (query) => {
  try {
    const correctedQuery = await fixSpelling(query);
    console.log("Corrected Query:", correctedQuery);

    const keywords = extractKeywords(correctedQuery);
    if (keywords.length === 0) return "No valid keywords found. Please refine your search.";

    let searchRegex = keywords.map(word => new RegExp(word, "i"));

    let products = await productModel.find({
      $or: [
        { name: { $in: searchRegex } },
        { description: { $in: searchRegex } },
        { category: { $in: searchRegex } }
      ]
    }).sort({ averageRating: -1 }).limit(5);

    if (products.length === 0) {
      const similarProducts = await productModel.find().limit(3);
      return similarProducts.length
        ? `No matching products found.

You may be interested in:
` +
          similarProducts.map(p => `- ${p.name} - ₱${p.price.toFixed(2)}`).join("\n")
        : "No matching products found. Please try another keyword.";
    }

    // Update ratings for each product before displaying
    const updatedProducts = await Promise.all(
      products.map(product => product.updateRatingStats())
    );

    const productDetails = await Promise.all(updatedProducts.map(async (product) => {
      const extraInfo = await fetchAdditionalProductInfo(product.name);
      const discountedPrice = product.discount > 0
        ? product.price - (product.price * (product.discount / 100))
        : product.price;

      return `Product: ${product.name}  
Price: ₱${product.price.toFixed(2)}  
Discount: ${product.discount}% (Final Price: ₱${discountedPrice.toFixed(2)})  
Stock: ${product.quantity} units  
Rating: ${product.averageRating}/5 (${product.totalReviews} reviews)  
Category: ${product.category}  
Description: ${product.description}  
More Info: ${extraInfo}`;
    }));

    return productDetails.join("\n\n");
  } catch (error) {
    console.error("Product search error:", error);
    return "Error searching for products.";
  }
};

const processMessage = async (query, isFirstInteraction = false) => {
  if (isFirstInteraction || /^(hello|hi|hey|good\s(morning|afternoon|evening|day))$/i.test(query.trim())) {
    return getWelcomeMessage();
  }

  const commonReplies = {
    "how are you": "I'm here to assist you anytime you need.",
    "what's your name": "I'm your AI shopping assistant, ready to help.",
    "thank you": "You're welcome. Let me know if you need anything else.",
    "bye": "Goodbye! Have a great day.",
    "who are you": "I'm your virtual shopping assistant, here to help with product searches and store information."
  };

  const lowerQuery = query.toLowerCase();
  if (commonReplies[lowerQuery]) {
    return commonReplies[lowerQuery];
  }

  return await searchProducts(query);
};

export const handleChat = async (req, res) => {
  console.log("Request received at /api/chat");

  const { query, userId, isFirstInteraction } = req.body;
  
  try {
    const response = isFirstInteraction ? getWelcomeMessage() : await processMessage(query);

    if (userId) {
      const chat = new AIChatModel({
        userId,
        userMessage: query,
        aiResponse: response,
        timestamp: new Date()
      });
      await chat.save();
      console.log("Chat saved to database");
    }

    res.json({ response });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ response: "Error processing your message." });
  }
};

export default processMessage;
