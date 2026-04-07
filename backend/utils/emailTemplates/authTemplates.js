export const resetPassword = (resetUrl, userName) => ({
  subject: 'Password Reset Request - Sports Event Management',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #5EC069, #4D86EE); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Sports Event Management</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hi ${userName},</p>
        <p>You have requested to reset your password. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #5EC069; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      </div>
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2024 Sports Event Management. All rights reserved.</p>
      </div>
    </div>
  `,
});

export const welcomeEmail = (userName, role, loginUrl) => ({
  subject: 'Welcome to Centre Pitch!',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #5EC069, #4D86EE); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Centre Pitch</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2 style="color: #333;">Welcome, ${userName}!</h2>
        <p>Thank you for joining Centre Pitch as a ${role}. We're excited to have you on board!</p>
        <p>With our platform, you can:</p>
        <ul style="color: #666;">
          <li>Discover and participate in sports events</li>
          <li>Connect with other players and teams</li>
          <li>Track your performance and achievements</li>
          <li>Organize your own events</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background: #4D86EE; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Get Started</a>
        </div>
      </div>
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2024 Centre Pitch. All rights reserved.</p>
      </div>
    </div>
  `,
});

export const otpVerification = (otp, userName) => ({
  subject: 'OTP Verification - Sports Event Management',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #5EC069, #4D86EE); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Sports Event Management</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2 style="color: #333;">OTP Verification</h2>
        <p>Hi ${userName},</p>
        <p>Your OTP for verification is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="background: #5EC069; color: white; padding: 15px 40px; font-size: 24px; letter-spacing: 5px; border-radius: 5px; display: inline-block;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This OTP will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      </div>
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2024 Sports Event Management. All rights reserved.</p>
      </div>
    </div>
  `,
});
