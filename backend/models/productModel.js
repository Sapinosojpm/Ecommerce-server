import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0},
  discount: {
    type: Number,
    default: 0, // Default to no discount
    validate: {
        validator: function (v) {
            return v >= 0 && v <= 100; // Ensure discount is between 0% and 100%
        },
        message: "Discount must be between 0 and 100.",
    },
},

  image: { type: Array, required: true },
  category: { type: String, required: true },
  bestseller: { type: Boolean, default: false },
  video: { type: String, required: false }, // Video URL field
  weight: {
    type: Number,
    required: true,
    min: [0, "Weight cannot be negative"],
  },
  quantity: {
    type: Number,
    default: 0,
    min: [0, 'Quantity cannot be negative'],
  },
  date: { type: Number, required: true }
});


const productModel = mongoose.models.product || mongoose.model("product", productSchema);

export default productModel;
