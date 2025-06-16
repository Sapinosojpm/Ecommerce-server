import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log("OpenAI API Key Check:", process.env.OPENAI_API_KEY ? "✅ Present" : "❌ Missing");

// Helper function to get context-aware responses
const getContextualResponse = (query) => {
  const lowerQuery = query.toLowerCase();
  
  // Shopping-related responses
  if (lowerQuery.includes('help') || lowerQuery.includes('assist')) {
    return `I'm your AI shopping assistant! I can help you:
    
• **Find Products** - Search by name, color, category, or style
• **Compare Items** - Get details about different products
• **Check Availability** - See what's in stock
• **Get Recommendations** - Find items based on your preferences

Try asking: "Show me black joggers" or "Find blue jeans under $50"`;
  }
  
  if (lowerQuery.includes('recommend') || lowerQuery.includes('suggest')) {
    return `I'd love to help you find the perfect products! Here are some popular categories:

• **Clothing** - Joggers, jeans, shirts, jackets, dresses
• **Footwear** - Sneakers, boots, casual shoes
• **Accessories** - Bags, watches, jewelry, hats

What type of product are you looking for? You can be specific like "black joggers for running" or general like "casual wear".`;
  }
  
  if (lowerQuery.includes('trending') || lowerQuery.includes('popular')) {
    return `Here are some trending product searches:

• **Black Joggers** - Perfect for casual wear and workouts
• **Blue Jeans** - Classic wardrobe staple
• **White Sneakers** - Versatile footwear for any outfit
• **Denim Jackets** - Great for layering

Would you like me to search for any of these, or are you looking for something specific?`;
  }
  
  // Size-related questions
  if (lowerQuery.includes('size') || lowerQuery.includes('sizing')) {
    return `For sizing information:

• Most clothing items have size charts available on the product page
• Sizes typically range from XS to XXL for clothing
• Shoes are available in standard US sizes
• Check product descriptions for specific measurements

Is there a particular item you need sizing help with?`;
  }
  
  // Price-related questions
  if (lowerQuery.includes('price') || lowerQuery.includes('cost') || lowerQuery.includes('cheap') || lowerQuery.includes('expensive')) {
    return `I can help you find products in your budget! 

• Use specific price ranges like "under $50" or "between $20-$40"
• Look for items with discounts for better deals
• Compare similar products to find the best value

What's your budget range, and what type of product are you looking for?`;
  }
  
  // Shipping/delivery questions
  if (lowerQuery.includes('shipping') || lowerQuery.includes('delivery')) {
    return `For shipping and delivery information:

• Standard shipping typically takes 3-7 business days
• Express shipping options are available for faster delivery
• Free shipping may be available on orders over certain amounts
• Check the checkout page for specific shipping costs and timeframes

Is there a specific product you'd like shipping information for?`;
  }
  
  return null; // Return null if no contextual response found
};

// General conversation handler for non-product searches
const handleGeneralChat = async (query) => {
  try {
    // First check for contextual responses
    const contextualResponse = getContextualResponse(query);
    if (contextualResponse) {
      return contextualResponse;
    }
    
    // Common greetings and responses
    const commonReplies = {
      "hello": "Hello! Welcome to our store! I'm your AI shopping assistant. How can I help you find the perfect products today?",
      "hi": "Hi there! I'm here to help you discover amazing products. What are you looking for?",
      "hey": "Hey! Ready to find some great products? Just tell me what you're looking for!",
      "good morning": "Good morning! Hope you're having a great day. How can I assist you with your shopping today?",
      "good afternoon": "Good afternoon! What can I help you find in our store today?",
      "good evening": "Good evening! I'm here to help you with any product questions or searches.",
      "how are you": "I'm doing great and ready to help you find exactly what you're looking for! What products interest you?",
      "what's your name": "I'm your AI shopping assistant! I'm here to help you discover and find the perfect products in our store.",
      "who are you": "I'm your personal AI shopping assistant, designed to help you find products, compare options, and answer questions about our store.",
      "thank you": "You're very welcome! I'm always here to help. Is there anything else you'd like to know about our products?",
      "thanks": "My pleasure! Feel free to ask if you need help finding anything else.",
      "bye": "Goodbye! Thanks for visiting. Come back anytime you need help finding great products!",
      "goodbye": "Take care! I'll be here whenever you need assistance with product searches or questions."
    };

    const lowerQuery = query.toLowerCase().trim();
    
    // Check for exact matches first
    if (commonReplies[lowerQuery]) {
      return commonReplies[lowerQuery];
    }
    
    // Check for partial matches
    for (const [key, response] of Object.entries(commonReplies)) {
      if (lowerQuery.includes(key)) {
        return response;
      }
    }
    
    // Use OpenAI for more complex conversations
    if (process.env.OPENAI_API_KEY) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful AI shopping assistant for an e-commerce store. Your responses should be:
            - Friendly and conversational
            - Focused on helping customers find products
            - Encouraging users to search for specific items
            - Brief but informative (2-3 sentences max)
            - Always end with a question or suggestion to keep the conversation going
            
            If users ask about products, encourage them to be specific with their search terms like colors, categories, or product names.`
          },
          { role: "user", content: query }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      return response.choices[0]?.message?.content.trim() || "I'm here to help you find great products! What are you looking for today?";
    }
    
    // Fallback response if OpenAI is not available
    return `I'm here to help you find amazing products! Try searching for specific items like "black joggers", "blue jeans", or "white sneakers". What are you looking for today?`;
    
  } catch (error) {
    console.error("Error in general chat handling:", error);
    return "I'm here to help you find great products! What are you looking for today?";
  }
};

// Main function that the controller calls
const processChatMessage = async (query, isFirstInteraction = false) => {
  try {
    console.log("Processing chat message:", query);
    
    // Handle first interaction
    if (isFirstInteraction) {
      return `Hello! Welcome to our AI-powered shopping assistant! 🛍️

I'm here to help you find the perfect products. You can:
• Search for specific items like "black joggers" or "blue jeans"
• Ask for recommendations by category
• Get help with sizes, prices, or product details
• Browse by color, style, or brand

What would you like to find today?`;
    }
    
    // For all other interactions, handle as general chat
    // The controller will handle product searches separately
    return await handleGeneralChat(query);
    
  } catch (error) {
    console.error("Error in processChatMessage:", error);
    return "I'm having trouble processing your message right now, but I'm still here to help you find great products! Try searching for specific items like 'joggers' or 'jeans'.";
  }
};

export default processChatMessage;