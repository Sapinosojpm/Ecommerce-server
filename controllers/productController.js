import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";
import mongoose from 'mongoose';

// Add a new product
const addProduct = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      price, 
      category, 
      bestseller, 
      quantity, 
      discount, 
      weight, 
      capital, 
      additionalCapital,
      vat, 
      variations 
    } = req.body;

    // Parse additionalCapital if it's a string
    let parsedAdditionalCapital = additionalCapital;
    if (typeof additionalCapital === 'string') {
      try {
        parsedAdditionalCapital = JSON.parse(additionalCapital);
      } catch (error) {
        console.error("Error parsing additionalCapital:", error);
        parsedAdditionalCapital = { type: "fixed", value: 0 };
      }
    }

    // Validate input data
    if (!name || !description || !price || !capital || !vat || !parsedAdditionalCapital || !category || !weight || isNaN(price) || Number(price) <= 0) {
      return res.status(400).json({ success: false, message: "Please provide valid product details." });
    }
    
    if (quantity === undefined || quantity === null || isNaN(quantity) || Number(quantity) < 0) {
      return res.status(400).json({ success: false, message: "Quantity must be a valid non-negative number." });
    }
    
    if (discount && (isNaN(discount) || discount < 0 || discount > 100)) {
      return res.status(400).json({ success: false, message: "Discount must be between 0 and 100." });
    }
    
    if (vat && (isNaN(vat) || vat < 0 || vat > 100)) {
      return res.status(400).json({ success: false, message: "VAT must be between 0 and 100." });
    }

    // Validate additionalCapital
    if (!parsedAdditionalCapital.type || !['fixed', 'percent'].includes(parsedAdditionalCapital.type)) {
      return res.status(400).json({ success: false, message: "Invalid additional capital type." });
    }
    
    if (parsedAdditionalCapital.value === undefined || parsedAdditionalCapital.value < 0) {
      return res.status(400).json({ success: false, message: "Additional capital value must be a non-negative number." });
    }

    // Validate variations if they exist
    let parsedVariations = [];
    if (variations) {
      try {
        parsedVariations = JSON.parse(variations);
        
        // Validate each variation
        for (const variation of parsedVariations) {
          if (!variation.name || typeof variation.name !== 'string') {
            return res.status(400).json({ success: false, message: "Each variation must have a valid name." });
          }
          
          if (!Array.isArray(variation.options) || variation.options.length === 0) {
            return res.status(400).json({ success: false, message: "Each variation must have at least one option." });
          }
          
          for (const option of variation.options) {
            if (!option.name || typeof option.name !== 'string') {
              return res.status(400).json({ success: false, message: "Each option must have a valid name." });
            }
            
            if (option.priceAdjustment === undefined || isNaN(option.priceAdjustment)) {
              return res.status(400).json({ success: false, message: "Each option must have a valid price adjustment." });
            }
            
            if (option.quantity === undefined || isNaN(option.quantity) || option.quantity < 0) {
              return res.status(400).json({ success: false, message: "Each option must have a valid non-negative quantity." });
            }
          }
        }
      } catch (error) {
        console.error("Error parsing variations:", error);
        return res.status(400).json({ success: false, message: "Invalid variations format." });
      }
    }

    // Handle file uploads
    const image1 = req.files.image1 && req.files.image1[0];
    const image2 = req.files.image2 && req.files.image2[0];
    const image3 = req.files.image3 && req.files.image3[0];
    const image4 = req.files.image4 && req.files.image4[0];
    const video = req.files.video && req.files.video[0];
    const images = [image1, image2, image3, image4].filter((image) => image !== undefined);

    // Upload images to Cloudinary
    let imagesUrl = await Promise.all(
      images.map(async (item) => {
        try {
          const result = await cloudinary.uploader.upload(item.path, { resource_type: "image" });
          return result.secure_url;
        } catch (error) {
          console.error(`Error uploading image: ${item.path}`, error);
          throw new Error("Image upload failed.");
        }
      })
    );

    // Upload video to Cloudinary
    let videoUrl = null;
    if (video) {
      try {
        const result = await cloudinary.uploader.upload(video.path, { resource_type: "video" });
        videoUrl = result.secure_url;
      } catch (error) {
        console.error("Error uploading video:", error);
        throw new Error("Video upload failed.");
      }
    }

    // Prepare product data
    const productData = {
      name,
      description,
      category,
      price: Number(price),
      bestseller: bestseller === "true",
      image: imagesUrl,
      video: videoUrl,
      capital: Number(capital),
      additionalCapital: {
        type: parsedAdditionalCapital.type,
        value: Number(parsedAdditionalCapital.value)
      },
      vat: Number(vat),
      quantity: Number(quantity),
      discount: discount ? Number(discount) : 0,
      date: Date.now(),
      weight: Number(weight),
      variations: parsedVariations
    };

    // Save product to database
    const product = new productModel(productData);
    await product.save();

    res.status(201).json({ success: true, message: "Product added successfully.", product });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// List all products with optional pagination
// productController.js
const listProduct = async (req, res) => {
  try {
    const { page = 1, limit = 0 } = req.query;
    const query = productModel.find({});
    
    if (Number(limit) > 0) {
      query.skip((page - 1) * limit).limit(Number(limit));
    }

    const products = await query.exec();

    const updatedProducts = products.map((product) => ({
      ...product.toObject(),
      finalPrice: product.price * ((100 - product.discount) / 100),
    }));

    const totalProducts = await productModel.countDocuments();

    res.json({ success: true, products: updatedProducts, total: totalProducts });
  } catch (error) {
    console.error("Error listing products:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const singleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid product ID format." 
      });
    }

    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found." 
      });
    }

    const finalPrice = product.price * ((100 - product.discount) / 100);
    res.json({ 
      success: true, 
      product: { ...product.toObject(), finalPrice } 
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Remove a product by ID
const removeProduct = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ success: false, message: "Product ID is required." });
    }

    // Find the product by its ID
    const product = await productModel.findById(id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Use findByIdAndDelete to remove the product
    await productModel.findByIdAndDelete(id);

    res.json({ success: true, message: "Product removed successfully." });
  } catch (error) {
    console.error("Error removing product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};



// Update product discount
const updateProductDiscount = async (req, res) => {
  const { id } = req.params;
  const { discount } = req.body;

  if (discount < 0 || discount > 100) {
    return res.status(400).json({
      success: false,
      message: 'Discount must be between 0 and 100.',
    });
  }

  try {
    const product = await productModel.findByIdAndUpdate(
      id,
      { $set: { discount: Number(discount) } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product discount updated successfully.',
      product,
    });
  } catch (error) {
    console.error('Error updating product discount:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
};

// Update Best Seller status
const updateBestSeller = async (req, res) => {
  const { id } = req.params;
  let { bestseller } = req.body;

  if (bestseller === undefined) {
    return res.status(400).json({
      success: false,
      message: "Best Seller status is required.",
    });
  }

  try {
    const product = await productModel.findByIdAndUpdate(
      id,
      { $set: { bestseller } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: `Best Seller status ${bestseller ? "enabled" : "disabled"} successfully.`,
      product,
    });
  } catch (error) {
    console.error("Error updating Best Seller status:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Update Product Price
const updateProductPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    // Validate price
    if (!price || price <= 0) {
      return res.status(400).json({ success: false, message: "Invalid price value." });
    }

    // Find and update product
    const updatedProduct = await productModel.findByIdAndUpdate(
      id,
      { price },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    res.json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error("Error updating product price:", error);
    res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
};

// Update product capital
const updateCapital = async (req, res) => {
  const { id } = req.params;
  const { capital } = req.body;

  if (capital === undefined || capital < 0 || isNaN(capital)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid capital value.',
    });
  }

  try {
    const product = await productModel.findByIdAndUpdate(
      id,
      { $set: { capital: Number(capital) } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product capital updated successfully.',
      product,
    });
  } catch (error) {
    console.error('Error updating product capital:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
};

// Update product additional capital
const updateAdditionalCapital = async (req, res) => {
  const { id } = req.params;
  const { additionalCapital } = req.body;

  // Validate input
  if (!additionalCapital || additionalCapital.value === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Additional capital value is required.'
    });
  }

  try {
    const product = await productModel.findByIdAndUpdate(
      id,
      { $set: { additionalCapital } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Additional capital updated successfully.',
      product,
    });
  } catch (error) {
    console.error('Error updating additional capital:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
};

// Update product VAT
const updateVAT = async (req, res) => {
  const { id } = req.params;
  const { vat } = req.body;

  if (vat === undefined || vat < 0 || vat > 100 || isNaN(vat)) {
    return res.status(400).json({
      success: false,
      message: 'VAT must be between 0 and 100.',
    });
  }

  try {
    const product = await productModel.findByIdAndUpdate(
      id,
      { $set: { vat: Number(vat) } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product VAT updated successfully.',
      product,
    });
  } catch (error) {
    console.error('Error updating product VAT:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
};

// Bulk upload products
const bulkUploadProducts = async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid product data format' 
      });
    }
    
    // Prepare products with default values for required fields
    const preparedProducts = products.map(product => ({
      name: product.Name || 'Unnamed Product',
      description: 'No description provided', // Required field
      category: product.Category || 'Uncategorized',
      price: Number(product.Price || 0),
      capital: Number(product.Capital || 0),
      additionalCapital: {
        type: 'fixed',
        value: Number(product['Additional Capital'] || 0)
      },
      vat: Number(product['VAT(%)'] || 0),
      discount: Number(product['Discount(%)'] || 0),
      quantity: Number(product.Quantity || 0),
      weight: Number(product['Weight(kg)'] || 0),
      bestseller: false,
      image: [], // Required field
      isActive: true // Default value
    }));

    // Insert with validation disabled temporarily
    const results = await productModel.insertMany(preparedProducts, { 
      ordered: false,
      bypassDocumentValidation: true 
    });
    
    const insertedCount = results.length;
    
    res.json({ 
      success: true, 
      message: `Successfully imported ${insertedCount} products`,
      insertedCount,
      products: results
    });
    
  } catch (error) {
    console.error('Error in bulk upload:', error);
    
    if (error.writeErrors) {
      const errors = error.writeErrors.map(err => ({
        index: err.index,
        error: err.errmsg
      }));
      
      return res.status(400).json({
        success: false,
        message: `Partial import completed with ${error.result.nInserted} products`,
        insertedCount: error.result.nInserted,
        errors
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error during bulk upload',
      error: error.message 
    });
  }
};

// Update product variations
const updateProductVariations = async (req, res) => {
  try {
    const { id } = req.params;
    const { variations } = req.body;

    if (!variations) {
      return res.status(400).json({ success: false, message: "Variations data is required." });
    }

    const product = await productModel.findByIdAndUpdate(
      id,
      { $set: { variations } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    res.status(200).json({
      success: true,
      message: "Product variations updated successfully.",
      product
    });
  } catch (error) {
    console.error("Error updating product variations:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Update ask for discount settings
const updateAskForDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const { askForDiscount } = req.body;

    if (!id || !askForDiscount) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    const product = await productModel.findByIdAndUpdate(
      id,
      { askForDiscount },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, product });
  } catch (error) {
    console.error("Error updating askForDiscount:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateProductVariationsAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { variations } = req.body;

    if (!variations) {
      return res.status(400).json({ 
        success: false, 
        message: "Variations data is required." 
      });
    }

    const product = await productModel.findByIdAndUpdate(
      id,
      { $set: { variations } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found." 
      });
    }

    res.status(200).json({
      success: true,
      message: "Product variations updated successfully.",
      product
    });
  } catch (error) {
    console.error("Error updating product variations:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};



export {
  updateProductVariations,
  updateAskForDiscount,
  listProduct,
  addProduct,
  removeProduct,
  singleProduct,
  updateProductDiscount,
  updateBestSeller,
  updateProductPrice,
  updateCapital,
  updateAdditionalCapital,
  updateVAT,
  bulkUploadProducts,
  updateProductVariationsAdmin,
};