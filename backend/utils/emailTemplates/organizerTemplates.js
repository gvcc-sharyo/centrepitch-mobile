export const organizerAddedByAdmin = (userName, email, password, loginUrl) => ({
  subject: 'Your Organizer Account Has Been Created – Centre Pitch',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #5EC069, #4D86EE); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Centre Pitch</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Organizer Account</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p style="color: #333; font-size: 16px;">Dear ${userName},</p>
        <p style="color: #555; line-height: 1.6;">Your organizer account has been created on Centre Pitch </p>
        <p style="color: #555; line-height: 1.6;">You can now log in and start creating and managing sports events.</p>
        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #4D86EE;">
          <h3 style="color: #4D86EE; margin-top: 0;">Your Login Credentials</h3>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> <code style="background: #f5f5f5; padding: 5px 10px; border-radius: 3px; font-size: 14px;">${password}</code></p>
          <p style="color: #f44336; font-size: 14px; margin-top: 15px;"><strong>⚠️ Important:</strong> Please change your password after first login for security.</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background: #5EC069; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now</a>
        </div>
        <p style="color: #666; font-size: 14px;">Once logged in, you'll be able to:</p>
        <ul style="color: #666; font-size: 14px;">
          <li>Create and manage events</li>
          <li>Manage teams and match schedules</li>
          <li>Track registrations and payments</li>
          <li>Invite scorers and staff</li>
        </ul>
      </div>
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2025 Centre Pitch. All rights reserved.</p>
      </div>
    </div>
  `,
});

export const scorerCredentials = (userName, email, password, loginUrl) => ({
  subject: 'Scorer Account Created - Sports Event Management',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #5EC069, #4D86EE); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Sports Event Management</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2 style="color: #333;">Scorer Account Created</h2>
        <p>Hi ${userName},</p>
        <p>Your scorer account has been created. You can now log in to manage matches and update scores for assigned events.</p>
        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #4D86EE;">
          <h3 style="color: #4D86EE; margin-top: 0;">Your Login Credentials</h3>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> <code style="background: #f5f5f5; padding: 5px 10px; border-radius: 3px; font-size: 14px;">${password}</code></p>
          <p style="color: #f44336; font-size: 14px; margin-top: 15px;"><strong>⚠️ Important:</strong> Please change your password after first login for security.</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background: #4D86EE; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now</a>
        </div>
        <p style="color: #666; font-size: 14px;">Once logged in, you'll be able to:</p>
        <ul style="color: #666; font-size: 14px;">
          <li>View events assigned to you</li>
          <li>Schedule matches for assigned events</li>
          <li>Update match scores in real-time</li>
          <li>Manage match results</li>
        </ul>
      </div>
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2024 Sports Event Management. All rights reserved.</p>
      </div>
    </div>
  `,
});
