import mongoose from 'mongoose';

const homePageSchema = new mongoose.Schema({
  components: {
    type: Map,
    of: Boolean, // Stores the status (enabled/disabled) of each component
    default: {
      DealsPopup: true,
      JobPostingPopup: true,
      Hero: true,
      ProductList: true,
      Intro: true,
      LatestCollection: true,
      BestSeller: true,
      AddReview: true,
      OurPolicy: true,
      NewsletterBox: true,
      SaleProductsList: true,
    },
  },
});

export default mongoose.model('HomePage', homePageSchema);
