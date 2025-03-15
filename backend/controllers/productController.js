import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js"; // Correct import for the model

// Add a new product
const addProduct = async (req, res) => {
    try {
        const { name, description, price, category, bestseller, quantity, discount, weight } = req.body;

        // Validate input data
        if (!name || !description || !price || !category || !weight || isNaN(price) || Number(price) <= 0) {
            return res.status(400).json({ success: false, message: "Please provide valid product details." });
        }
        if (quantity === undefined || quantity === null || isNaN(quantity) || Number(quantity) < 0) {
            return res.status(400).json({ success: false, message: "Quantity must be a valid non-negative number." });
        }
        if (discount && (isNaN(discount) || discount < 0 || discount > 100)) {
            return res.status(400).json({ success: false, message: "Discount must be between 0 and 100." });
        }

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
        // video upload
        let videoUrl = null;
        if (video) {
            try {
                const videoResult = await cloudinary.uploader.upload(video.path, {
                    resource_type: "video",
                    public_id: `product_video_${Date.now()}`,
                });
                videoUrl = videoResult.secure_url;
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
            bestseller: bestseller === "true" ? true : false,
            image: imagesUrl,
            video: videoUrl,
            quantity: Number(quantity),
            discount: discount ? Number(discount) : 0, // Include discount
            date: Date.now(),
            weight: Number(weight),
            
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
const listProduct = async (req, res) => {
    try {
        const { page = 1, limit = 0 } = req.query;

        const products = await productModel
            .find({})
            .skip((page - 1) * limit)
            .limit(Number(limit));

        // Include final price after discount
        const updatedProducts = products.map((product) => ({
            ...product.toObject(),
            finalPrice: product.price * ((100 - product.discount) / 100), // Calculate final price
        }));

        const totalProducts = await productModel.countDocuments();

        res.json({ success: true, products: updatedProducts, total: totalProducts });
    } catch (error) {
        console.error("Error listing products:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Remove a product by ID
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


// Get a single product by ID
const singleProduct = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ success: false, message: "Product ID is required." });
        }

        const product = await productModel.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        // Calculate final price with discount
        const finalPrice = product.price * ((100 - product.discount) / 100);

        res.json({ success: true, product: { ...product.toObject(), finalPrice } });
    } catch (error) {
        console.error("Error fetching product:", error);
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






export { listProduct, addProduct, removeProduct, singleProduct,updateProductDiscount,updateBestSeller,updateProductPrice };
