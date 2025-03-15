// models/footerModel.js
import mongoose from 'mongoose';

const footerSchema = new mongoose.Schema({
  companyInfo: String,
  companyLinks: [String],
  contactInfo: [String],
  copyrightText: String,
});

const Footer = mongoose.model('Footer', footerSchema);

export default Footer;
