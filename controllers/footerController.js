// controllers/footerController.js

import Footer from '../models/footerModel.js'; // Assuming you have a Footer model

// Fetch Footer Data
export const getFooterData = async (req, res) => {
  try {
    const footer = await Footer.findOne();
    if (!footer) {
      return res.status(404).json({ message: 'Footer data not found' });
    }
    res.json(footer);
  } catch (error) {
    console.error('Error fetching footer data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Footer Data
export const updateFooterData = async (req, res) => {
  const { companyInfo, companyLinks, contactInfo, copyrightText, logoUrl } = req.body;

  try {
    const footer = await Footer.findOne();
    if (!footer) {
      return res.status(404).json({ message: 'Footer data not found' });
    }

    // Update Footer data
    footer.companyInfo = companyInfo || footer.companyInfo;
    footer.companyLinks = companyLinks || footer.companyLinks;
    footer.contactInfo = contactInfo || footer.contactInfo;
    footer.copyrightText = copyrightText || footer.copyrightText;
    footer.logoUrl = logoUrl || footer.logoUrl;

    await footer.save();
    res.json(footer);
  } catch (error) {
    console.error('Error updating footer data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
