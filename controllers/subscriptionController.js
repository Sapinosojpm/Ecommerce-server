import nodemailer from 'nodemailer';
import Subscriber from '../models/subscriber.js';
import Discount from '../models/adminDiscount.js'; // Ensure correct import

export const subscribe = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Check if email is already subscribed
    const existingSubscriber = await Subscriber.findOne({ email });
    if (existingSubscriber) {
      return res.status(400).json({ message: 'You are already subscribed!' });
    }

    // Fetch the latest active discount from the adminDiscount model
    const discount = await Discount.findOne();
    if (!discount || !discount.discountCode || !discount.discountPercent) {
      return res.status(500).json({ message: 'No active discount available' });
    }

    const discountCode = discount.discountCode; // Ensure we have the discountCode
    const discountPercent = discount.discountPercent;

    // Save the subscriber with the fetched discount value and discount code
    const newSubscriber = new Subscriber({
      email,
      discountCode, // Include the discountCode here
      discountPercent,
    });
    await newSubscriber.save();

    // Send the discount code via email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to our Newsletter!',
      text: `Thank you for subscribing! You've received a ${discountPercent}% off discount. Use the code ${discountCode} at checkout!`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'Subscription successful! Check your email for a discount.',
      discountAmount: discountPercent,
    });
  } catch (error) {
    console.error('Error during subscription:', error); // Log detailed error
    res.status(500).json({ message: 'An error occurred. Please try again later.', error: error.message });
  }
};
