export const eventRegistration = (userName, eventName, eventDetails) => ({
  subject: `Registration Confirmed – ${eventName} | Centre Pitch`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #5EC069, #4D86EE); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Centre Pitch</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Event Registration</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p style="color: #333; font-size: 16px;">Dear ${userName},</p>
        <p style="color: #555; line-height: 1.6;">Your registration for <strong>${eventName}</strong> has been confirmed.</p>
        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #5EC069;">
          <h3 style="color: #2d3748; margin-top: 0; font-size: 15px;">Event Details</h3>
          <p style="color: #555; margin: 8px 0;"><strong>Date:</strong> ${eventDetails.date}</p>
          <p style="color: #555; margin: 8px 0;"><strong>Venue:</strong> ${eventDetails.venue}</p>
          <p style="color: #555; margin: 8px 0;"><strong>Location:</strong> ${eventDetails.location}</p>
        </div>
        <p style="color: #555; line-height: 1.6;">We look forward to seeing you at the event. Good luck!</p>
      </div>
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2025 Centre Pitch. All rights reserved.</p>
      </div>
    </div>
  `,
});

export const eventNotification = (userName, eventName, message, type) => ({
  subject: `${type === 'cancelled' ? 'Event Cancelled' : type === 'rescheduled' ? 'Event Rescheduled' : 'Event Update'} – ${eventName} | Centre Pitch`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #5EC069, #4D86EE); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Centre Pitch</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Event ${type.charAt(0).toUpperCase() + type.slice(1)}</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p style="color: #333; font-size: 16px;">Dear ${userName},</p>
        <p style="color: #555; line-height: 1.6;">${message}</p>
        <div style="background: ${type === 'cancelled' ? '#ffebee' : '#e3f2fd'}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${type === 'cancelled' ? '#e53935' : '#1976d2'};">
          <p style="margin: 0; color: #333; font-weight: 600;">${eventName}</p>
        </div>
        <p style="color: #555; line-height: 1.6;">${type === 'cancelled' ? 'We apologise for any inconvenience. Please check Centre Pitch for other upcoming events.' : 'Please update your calendar and plan accordingly.'}</p>
      </div>
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2025 Centre Pitch. All rights reserved.</p>
      </div>
    </div>
  `,
});
