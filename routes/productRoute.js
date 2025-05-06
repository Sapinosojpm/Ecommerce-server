import express from 'express';
import productModel from '../models/productModel.js';
import {
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
  updateAskForDiscount,
  updateProductVariationsAdmin
} from '../controllers/productController.js';
import upload from '../middleware/multer.js';
import adminAuth from '../middleware/adminAuth.js';

const productRouter = express.Router();

// Get a list of products
productRouter.get('/list', listProduct);

// Get a single product by ID
productRouter.get('/:id', singleProduct);

// Add a new product
productRouter.post(
  '/add',
  adminAuth,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]),
  addProduct
);

// Delete a product
productRouter.delete('/delete', adminAuth, removeProduct);

// Update product quantity
productRouter.put('/updateQuantity/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!id || quantity === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Product ID and quantity are required.',
    });
  }

  if (Number(quantity) < 0) {
    return res.status(400).json({
      success: false,
      message: 'Quantity cannot be negative.',
    });
  }

  try {
    const product = await productModel.findByIdAndUpdate(
      id,
      { $set: { quantity: Number(quantity) } },
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
      message: 'Product quantity updated successfully.',
      product,
    });
  } catch (error) {
    console.error('Error updating product quantity:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
});

// Update product discount
productRouter.put('/updateDiscount/:id', adminAuth, updateProductDiscount);
// Update Best Seller status
productRouter.put('/updateBestSeller/:id', adminAuth, updateBestSeller);
productRouter.put('/updatePrice/:id', adminAuth, updateProductPrice);
productRouter.put('/updateCapital/:id', adminAuth, updateCapital);
productRouter.put('/updateAdditionalCapital/:id', adminAuth, updateAdditionalCapital);
productRouter.put('/updateVAT/:id', adminAuth, updateVAT);
productRouter.post('/bulk', adminAuth, bulkUploadProducts);
productRouter.put('/updateVariations/:id', adminAuth, updateProductVariationsAdmin);
// Update askForDiscount for a product
productRouter.put("/updateAskForDiscount/:id", adminAuth, updateAskForDiscount);

export default productRouter;
