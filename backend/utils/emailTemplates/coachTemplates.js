import { escapeHtml } from './helpers.js';

const DEFAULT_SUPPORT = 'support@centrepitch.com';

export const coachRegistrationReceived = (
  coachName,
  supportEmail = DEFAULT_SUPPORT
) => ({
  subject: 'Coach Registration Received – Centre Pitch',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #5EC069, #4D86EE); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Centre Pitch</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Coach Registration</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p style="color: #333; font-size: 16px;">Dear ${coachName},</p>
        <p style="color: #555; line-height: 1.6;">Thank you for registering as a coach on Centre Pitch.</p>
        <p style="color: #555; line-height: 1.6;">Your application has been received and is under review. Our team will verify your documents and get back to you within 3–5 business days.</p>
        <p style="color: #333; font-size: 15px; margin-top: 24px;"><strong>What happens next?</strong></p>
        <ul style="color: #555; line-height: 1.8; padding-left: 20px;">
          <li>Document verification</li>
          <li>Approval notification via email</li>
          <li>Access to your coach dashboard</li>
        </ul>
        <p style="color: #555; line-height: 1.6; margin-top: 24px;">In the meantime, you can contact us at <a href="mailto:${supportEmail}" style="color: #4D86EE;">${supportEmail}</a> for any queries.</p>
      </div>
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2025 Centre Pitch. All rights reserved.</p>
      </div>
    </div>
  `,
});

export const coachApprovalSuccess = (
  coachName,
  loginUrl,
  trialExpiryDate,
  supportEmail = DEFAULT_SUPPORT
) => ({
  subject: 'Your Coach Profile Has Been Approved – Centre Pitch',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #5EC069, #4D86EE); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Centre Pitch</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Coach Approved</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p style="color: #333; font-size: 16px;">Dear ${coachName},</p>
        <p style="color: #555; line-height: 1.6;">Congratulations! Your coach profile has been approved on Centre Pitch.</p>
        <p style="color: #555; line-height: 1.6;">You can now log in and start managing your coach dashboard.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background: #5EC069; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Login to Dashboard</a>
        </div>
        <p style="color: #555; line-height: 1.6;">Your trial period is active until <strong>${trialExpiryDate}</strong>. During this time you can:</p>
        <ul style="color: #555; line-height: 1.8; padding-left: 20px;">
          <li>Set up your profile and availability</li>
          <li>Connect with academies (if applicable)</li>
          <li>Accept coaching sessions and bookings</li>
          <li>Manage students and earnings</li>
        </ul>
        <p style="color: #555; line-height: 1.6; margin-top: 24px;">Need help? Contact us at <a href="mailto:${supportEmail}" style="color: #4D86EE;">${supportEmail}</a>.</p>
      </div>
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2025 Centre Pitch. All rights reserved.</p>
      </div>
    </div>
  `,
});

export const coachRejection = (
  coachName,
  reason,
  supportEmail = DEFAULT_SUPPORT
) => {
  const safeReason = escapeHtml(reason);
  return {
    subject: 'Coach Registration Update – Centre Pitch',
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #5EC069, #4D86EE); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Centre Pitch</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Coach Registration Update</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p style="color: #333; font-size: 16px;">Dear ${coachName},</p>
        <p style="color: #555; line-height: 1.6;">Thank you for your interest in joining Centre Pitch as a coach.</p>
        <p style="color: #555; line-height: 1.6;">After careful review, we are unable to approve your coach application at this time.</p>
        <p style="color: #333; font-size: 15px; margin-top: 24px;"><strong>Reason for this decision:</strong></p>
        <div style="background: #fff; border-left: 4px solid #4D86EE; padding: 16px 20px; margin: 16px 0; color: #555; line-height: 1.6;">${safeReason}</div>
        <p style="color: #555; line-height: 1.6;">If you believe this decision was made in error or would like to address the concerns above, please contact us at <a href="mailto:${supportEmail}" style="color: #4D86EE;">${supportEmail}</a>. We are happy to assist and discuss next steps.</p>
        <p style="color: #555; line-height: 1.6; margin-top: 24px;">Thank you for considering Centre Pitch.</p>
      </div>
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2025 Centre Pitch. All rights reserved.</p>
      </div>
    </div>
  `,
  };
};
