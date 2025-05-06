import mongoose from "mongoose";

const variationOptionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  priceAdjustment: { 
    type: Number, 
    default: 0,
    min: 0
  },
  quantity: { 
    type: Number, 
    default: 0,
    min: 0
  },
  sku: {
    type: String,
    required: false,
    unique: false // Only if you're managing full combinations elsewhere
  }
  
});

const variationSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  options: [variationOptionSchema]
});

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    index: true,
    text: true
  },
  description: { 
    type: String, 
    required: true,
    text: true 
  },
  price: { 
    type: Number, 
    required: true, 
    min: 0,
    set: v => Math.floor(v)
  },
  capital: { 
    type: Number, 
    required: true, 
    min: 0
  },
  additionalCapital: {
    type: {
      type: String,
      enum: ["fixed", "percent"],
      default: "fixed"
    },
    value: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  discount: {
    type: Number,
    default: 0,
    validate: {
      validator: (v) => v >= 0 && v <= 100,
      message: "Discount must be between 0-100%."
    },
  },
  askForDiscount: {
    type: {
      type: String,
      enum: ["percent", "amount"],
      default: "percent",
      required: true
    },
    value: {
      type: Number,
      min: 0,
      default: 0,
      required: true
    },
    enabled: {
      type: Boolean,
      default: false,
      required: true
    }
  },
  vat: {
    type: Number,
    default: 0,
    validate: {
      validator: (v) => v >= 0 && v <= 100,
      message: "VAT must be between 0-100%."
    },
  },
  image: [{ type: String }],
  category: {
    type: String,
    required: true,
    index: true
  },
  bestseller: { type: Boolean, default: false },
  tags: [{ type: String }],
  video: { type: String, required: false },
  weight: {
    type: Number,
    required: true,
    min: [0, "Weight cannot be negative"],
  },
  // quantity: {
  //   type: Number,
  //   default: 0,
  //   min: 0
  // },
  variations: {
    type: [variationSchema],
    default: []
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  date: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});


// Middleware to calculate price before saving
productSchema.pre('save', function(next) {

  if (this.variations && this.variations.length > 0) {
    let totalQuantity = 0;
    this.variations.forEach(variation => {
      variation.options.forEach(option => {
        totalQuantity += option.quantity || 0;
      });
    });
    this.quantity = totalQuantity;
  }
  // Calculate additional capital
  let additionalCapital = 0;
  if (this.additionalCapital) {
    additionalCapital = this.additionalCapital.type === 'percent'
      ? this.capital * (this.additionalCapital.value / 100)
      : this.additionalCapital.value;
  }

  

  // Calculate base price
  const basePrice = this.capital + additionalCapital;

  // Apply VAT
  const priceWithVat = basePrice * (1 + (this.vat / 100));

  // Apply discount
  const finalPrice = this.discount > 0
    ? priceWithVat * (1 - (this.discount / 100))
    : priceWithVat;

  // Update the price field
  this.price = Math.max(0, finalPrice);

  next();
});

// Middleware to recalculate price when specific fields are updated
productSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  const fieldsToWatch = ['capital', 'additionalCapital', 'vat', 'discount'];
  
  // Check if any of the watched fields are being updated
  const shouldRecalculate = fieldsToWatch.some(field => field in update);
  
  if (shouldRecalculate) {
    try {
      const docToUpdate = await this.model.findOne(this.getQuery());
      
      if (docToUpdate) {
        // Calculate additional capital
        let additionalCapital = 0;
        const additionalCapitalData = update.additionalCapital || docToUpdate.additionalCapital;
        
        if (additionalCapitalData) {
          additionalCapital = additionalCapitalData.type === 'percent'
            ? (update.capital || docToUpdate.capital) * (additionalCapitalData.value / 100)
            : additionalCapitalData.value;
        }

        // Calculate base price
        const basePrice = (update.capital || docToUpdate.capital) + additionalCapital;

        // Apply VAT
        const vat = update.vat || docToUpdate.vat;
        const priceWithVat = basePrice * (1 + (vat / 100));

        // Apply discount
        const discount = update.discount || docToUpdate.discount;
        const finalPrice = discount > 0
          ? priceWithVat * (1 - (discount / 100))
          : priceWithVat;

        // Update the price in the update object
        this.setUpdate({
          ...update,
          price: Math.max(0, finalPrice)
        });
      }
    } catch (error) {
      console.error('Error in pre-findOneAndUpdate hook:', error);
    }
  }
  
  next();
});

productSchema.methods.updateRatingStats = async function() {
  const reviews = await mongoose.model('ProductReview').find({ productId: this._id });
  
  if (reviews.length > 0) {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    this.averageRating = parseFloat((totalRating / reviews.length).toFixed(1));
    this.totalReviews = reviews.length;
  } else {
    this.averageRating = 0;
    this.totalReviews = 0;
  }
  
  await this.save();
  return this;
};

productSchema.index({
  name: 'text',
  description: 'text', 
  category: 'text',
  tags: 'text'
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;