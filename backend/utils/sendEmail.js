import nodemailer from 'nodemailer';
import { emailTemplates } from './emailTemplates/index.js';

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS 
    }
  });

  const mailOptions = {
    from: `Centre Pitch <${process.env.EMAIL_USER}>`,
    to: options.to,
    subject: options.subject,
    html: options.html || options.text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

export { emailTemplates };
export default sendEmail;
