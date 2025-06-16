import processChatMessage from "../utils/processChatMessage.js";
import Product from "../models/productModel.js";
import AIChat from "../models/AIChatModel.js";

// Helper function to extract search terms from user query
const extractSearchTerms = (query) => {
  const lowerQuery = query.toLowerCase();
  
  // Common product-related keywords
  const productKeywords = [
    'show', 'find', 'search', 'look', 'get', 'buy', 'purchase', 'need', 'want', 
    'looking for', 'searching for', 'shop', 'shopping', 'browse'
  ];
  
  // Color keywords
  const colors = [
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 
    'pink', 'brown', 'gray', 'grey', 'navy', 'maroon', 'beige', 'tan'
  ];
  
  // Clothing/product keywords
  const productTypes = [
    'jogger', 'joggers', 'pants', 'jeans', 'shirt', 'jacket', 'dress', 'shoes', 
    'sneakers', 'boots', 'hoodie', 'sweater', 't-shirt', 'shorts', 'skirt', 
    'blouse', 'coat', 'hat', 'cap', 'bag', 'backpack', 'watch', 'jewelry'
  ];
  
  const hasProductKeyword = productKeywords.some(keyword => lowerQuery.includes(keyword));
  const foundColors = colors.filter(color => lowerQuery.includes(color));
  const foundProductTypes = productTypes.filter(type => lowerQuery.includes(type));
  
  return {
    isProductSearch: hasProductKeyword || foundColors.length > 0 || foundProductTypes.length > 0,
    colors: foundColors,
    productTypes: foundProductTypes,
    searchTerms: [...foundColors, ...foundProductTypes]
  };
};

// Function to search products based on extracted terms
const searchProducts = async (searchTerms, originalQuery) => {
  try {
    if (searchTerms.length === 0) {
      // If no specific terms found, do a text search on the entire query
      const textSearchResults = await Product.find(
        { $text: { $search: originalQuery } },
        { score: { $meta: "textScore" } }
      )
      .sort({ score: { $meta: "textScore" } })
      .limit(10);
      
      if (textSearchResults.length > 0) {
        return textSearchResults;
      }
    }
    
    // Build search query with regex for flexible matching
    const searchQuery = {
      $or: [
        // Search in name
        {
          name: {
            $regex: searchTerms.join('|'),
            $options: 'i'
          }
        },
        // Search in description
        {
          description: {
            $regex: searchTerms.join('|'),
            $options: 'i'
          }
        },
        // Search in category
        {
          category: {
            $regex: searchTerms.join('|'),
            $options: 'i'
          }
        },
        // Search in tags
        {
          tags: {
            $in: searchTerms.map(term => new RegExp(term, 'i'))
          }
        }
      ]
    };
    
    const products = await Product.find(searchQuery)
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(10);
    
    return products;
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
};

export const AIChatController = async (req, res) => {
  console.log("📩 Received Request at /api/chat");

  const { query } = req.body;
  if (!query) {
    console.log("❌ No query provided");
    return res.status(400).json({ response: "No query provided" });
  }

  try {
    console.log("✅ Query Received:", query);

    // Extract search terms and determine if this is a product search
    const searchAnalysis = extractSearchTerms(query);
    
    let products = [];
    let aiResponse = "";
    
    if (searchAnalysis.isProductSearch) {
      console.log("🔍 Product search detected, searching for:", searchAnalysis.searchTerms);
      
      // Search for products
      products = await searchProducts(searchAnalysis.searchTerms, query);
      
      if (products.length > 0) {
        // Generate AI response with product information
        const productNames = products.slice(0, 3).map(p => p.name).join(', ');
        aiResponse = `I found ${products.length} products matching your search! Here are some great options:\n\n`;
        
        products.slice(0, 3).forEach((product, index) => {
          aiResponse += `${index + 1}. **${product.name}** - $${product.price}\n`;
          aiResponse += `   ${product.description.substring(0, 100)}...\n`;
          if (product.averageRating > 0) {
            aiResponse += `   ⭐ ${product.averageRating}/5 (${product.totalReviews} reviews)\n`;
          }
          aiResponse += `\n`;
        });
        
        aiResponse += `You can see all the search results on the right side. Each product shows detailed information including images, prices, and ratings. Click "Add to Cart" to purchase any item that interests you!`;
      } else {
        aiResponse = `I couldn't find any products matching "${query}". Try searching with different keywords like:
- Color + item (e.g., "black joggers", "blue jeans")
- Specific product names
- Category names

You can also browse our categories or ask me for recommendations!`;
      }
    } else {
      // Regular chat - process with AI
      aiResponse = await processChatMessage(query);
    }

    console.log("✅ AI Response:", aiResponse);
    console.log("📦 Products found:", products.length);

    // Save to database
    const chat = new AIChat({ userMessage: query, aiResponse });
    await chat.save();
    console.log("💾 Chat Saved to Database");

    // Format products for frontend
    const formattedProducts = products.map(product => ({
      id: product._id,
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image && product.image.length > 0 ? product.image[0] : null,
      rating: product.averageRating,
      totalReviews: product.totalReviews,
      category: product.category,
      discount: product.discount,
      variations: product.variations
    }));

    console.log("Formatted Products:", formattedProducts);

    res.json({ 
      response: aiResponse,
      products: formattedProducts
    });
  } catch (error) {
    console.error("❌ Error in AIChatController:", error);
    res.status(500).json({ 
      response: "An error occurred while processing your message.",
      products: []
    });
  }
};