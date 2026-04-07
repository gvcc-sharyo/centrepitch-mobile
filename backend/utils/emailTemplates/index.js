/**
 * Central export for all email templates.
 * Combines templates from role-specific modules for backward compatibility.
 */
import * as auth from './authTemplates.js';
import * as academy from './academyTemplates.js';
import * as coach from './coachTemplates.js';
import * as event from './eventTemplates.js';
import * as organizer from './organizerTemplates.js';

export const emailTemplates = {
  // Auth
  resetPassword: auth.resetPassword,
  welcomeEmail: auth.welcomeEmail,
  otpVerification: auth.otpVerification,
  // Academy
  academyRegistrationReceived: academy.academyRegistrationReceived,
  academyApprovalSuccess: academy.academyApprovalSuccess,
  academyRejection: academy.academyRejection,
  // Coach
  coachRegistrationReceived: coach.coachRegistrationReceived,
  coachApprovalSuccess: coach.coachApprovalSuccess,
  coachRejection: coach.coachRejection,
  // Event
  eventRegistration: event.eventRegistration,
  eventNotification: event.eventNotification,
  // Organizer
  organizerAddedByAdmin: organizer.organizerAddedByAdmin,
  scorerCredentials: organizer.scorerCredentials,
};
