import nodemailer from 'nodemailer';

const sendEmail = async (req, res) => {
  const { message } = req.body;

  // Log the received message for debugging
  console.log('Received message:', message);

  // Ensure userEmail is present (extract from the token)
  const userEmail = req.userEmail;  // Extract email from the authUser middleware

  if (!userEmail) {
    console.error('User email is missing');
    return res.status(400).json({ error: 'User email is required' });
  }

  if (!message || message.trim() === '') {
    console.error('Message content is missing');
    return res.status(400).json({ error: 'Message content is required' });
  }

  const mailOptions = {
    from: userEmail,  // Use the user's email from the request
    to: process.env.EMAIL_RECEIVER, // This is your email or admin email
    subject: 'New Chat Message from Client',
    text: `A client sent the following message: ${message}`,
  };

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // The email account you're using for sending the email
      pass: process.env.EMAIL_PASSWORD, // The app password or regular password for the sending account
    },
  });

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', mailOptions); // Log the mail options for debugging
    return res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error.message, error.stack); // Log more details about the error
    return res.status(500).json({ error: `Error sending email: ${error.message}` });
  }
};
export { sendEmail };
