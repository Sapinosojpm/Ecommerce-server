import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  businessName: String,
  address: String,
  telephone: [String], // Telephone as an array of strings
  email: [String], // Email as an array of strings
  image: String, // Store the image path
});

const Contact = mongoose.model('Contact', contactSchema);

export default Contact;
