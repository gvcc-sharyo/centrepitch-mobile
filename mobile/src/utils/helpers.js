import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';
import axios from 'axios';

// Debounce function
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Format date
export const formatDate = (date, formatStr = 'MMM dd, yyyy') => {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr);
  } catch {
    return '';
  }
};

// Format date and time
export const formatDateTime = (date) => {
  return formatDate(date, 'MMM dd, yyyy HH:mm');
};

// Format relative time
export const formatRelativeTime = (date) => {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return '';
  }
};

// Format currency
export const formatCurrency = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

// Format number with commas
export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-IN').format(num || 0);
};

// Truncate text
export const truncate = (str, length = 50) => {
  if (!str) return '';
  return str.length > length ? `${str.substring(0, length)}...` : str;
};

// Get initials from name
export const getInitials = (name) => {
  if (!name) return '';
  const names = name.split(' ');
  return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Check if date is in the future
export const isFutureDate = (date) => {
  if (!date) return false;
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return isAfter(dateObj, new Date());
};

// Check if date is in the past
export const isPastDate = (date) => {
  if (!date) return false;
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return isBefore(dateObj, new Date());
};

// Get event status (lifecycle from dates; cancelled/postponed from backend)
export const getEventStatus = (event) => {
  if (!event) return 'upcoming';
  if (event.status === 'cancelled') return 'cancelled';
  if (event.status === 'postponed') return 'postponed';
  if (event.status === 'draft' && !event.isPublished) return 'draft';
  const startDate = event?.startDate ? parseISO(event.startDate) : null;
  const endDate = event?.endDate ? parseISO(event.endDate) : null;
  if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return event.status || 'upcoming';
  }
  const now = new Date();
  if (isBefore(endDate, now)) return 'completed';
  if (isBefore(startDate, now) && isAfter(endDate, now)) return 'live';
  return 'upcoming';
};

// Calculate days until event
export const daysUntilEvent = (date) => {
  if (!date) return null;
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffTime = dateObj - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Validate email
export const isValidEmail = (email) => {
  const regex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return regex.test(email);
};

// Validate phone number (Indian: 10 digits, starts with 6–9)
// Accepts "9876543210", "98 765 43210", "+91 9876543210" — normalizes before check
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(digits);
};

// Restrict phone input: digits only (0-9), max 10 digits — prevents letters and symbols
export const sanitizePhoneInput = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/[^0-9]/g, '').slice(0, 10);
};

// HTTP status code to user-friendly message mapping
const httpErrorMessages = {
  400: 'Invalid request. Please check your input and try again.',
  401: 'Your session has expired. Please log in again.',
  403: 'You don\'t have permission to perform this action.',
  404: 'The requested resource was not found.',
  408: 'Request timed out. Please try again.',
  409: 'This action conflicts with existing data.',
  413: 'The file you\'re uploading is too large.',
  422: 'The provided data is invalid. Please check and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Server error. Our team has been notified. Please try again later.',
  502: 'Server is temporarily unavailable. Please try again later.',
  503: 'Service is temporarily unavailable. Please try again later.',
  504: 'Server took too long to respond. Please try again.',
};

// Get error message from API response - user-friendly version
export const getErrorMessage = (error) => {
  // Handle null/undefined error
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  // Network errors (no response from server)
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'The request timed out. Please try again.';
  }

  // Cancelled request
  if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') {
    return 'Request was cancelled.';
  }

  // Server responded with an error
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    // Backend sent a specific message
    if (data?.message && typeof data.message === 'string') {
      return data.message;
    }

    // Backend sent validation errors
    if (data?.errors && Array.isArray(data.errors)) {
      return data.errors.map(e => e.message || e.msg || e).join('. ');
    }

    // Backend sent error field
    if (data?.error && typeof data.error === 'string') {
      return data.error;
    }

    // Use HTTP status code mapping
    if (httpErrorMessages[status]) {
      return httpErrorMessages[status];
    }

    // Generic HTTP error
    return `Something went wrong (Error ${status}). Please try again.`;
  }

  // JavaScript/Client-side errors - make them user-friendly
  if (error.message) {
    // Don't show technical messages like "AxiosError" to users
    const technicalPatterns = [
      /^AxiosError/i,
      /^TypeError/i,
      /^ReferenceError/i,
      /^SyntaxError/i,
      /^Error:/i,
    ];

    for (const pattern of technicalPatterns) {
      if (pattern.test(error.message)) {
        return 'Something went wrong. Please try again.';
      }
    }

    // If it's a relatively readable message, use it
    if (error.message.length < 100 && !error.message.includes('at ')) {
      return error.message;
    }
  }

  return 'An unexpected error occurred. Please try again.';
};

// Capitalize first letter
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Convert snake_case to Title Case
export const snakeToTitle = (str) => {
  if (!str) return '';
  return str
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
};

// Generate Google Maps URL
export const getGoogleMapsUrl = (location) => {
  if (!location) return '#';
  const address = [
    location.venue,
    location.address,
    location.city,
    location.state,
    location.country
  ].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

// Event type options
export const eventTypes = [
  { value: 'cricket', label: 'Cricket' },
  { value: 'football', label: 'Football' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'badminton', label: 'Badminton' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'hockey', label: 'Hockey' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'athletics', label: 'Athletics' },
  { value: 'other', label: 'Other' }
];

// Get event type label
export const getEventTypeLabel = (type) => {
  const eventType = eventTypes.find(e => e.value === type);
  return eventType?.label || capitalize(type);
};

// User role options
export const userRoles = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'organizer', label: 'Event Organizer' },
  { value: 'player', label: 'Player/Participant' },
  // { value: 'academyadmin', label: 'Academy Admin' }, // ✅ ADD
  // { value: 'coach', label: 'Coach' },                // ✅ ADD
  // { value: 'scorer', label: 'Scorer' }
];

// Staff role options
export const staffRoles = [
  { value: 'scorer', label: 'Scorer' },
  { value: 'referee', label: 'Referee' },
  { value: 'coach', label: 'Coach' },
  { value: 'manager', label: 'Manager' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'medical', label: 'Medical Staff' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'other', label: 'Other' }
];

/** Academy card title: matches web `formatAcademyNameWithCreator`. */
export function formatAcademyNameWithCreator(academy) {
  const academyName = String(academy?.name || "").trim();
  const creator = academy?.adminUser;
  let creatorName = "";
  if (creator && typeof creator === "object") {
    const fn = String(creator.firstName || "").trim();
    const ln = String(creator.lastName || "").trim();
    creatorName = [fn, ln].filter(Boolean).join(" ");
    if (!creatorName && typeof creator.name === "string") creatorName = creator.name.trim();
  }
  if (!academyName) return creatorName || "";
  if (!creatorName) return academyName;
  return `${academyName} - ${creatorName}`;
}

export const indianStates = [
  { value: 'andhra-pradesh', label: 'Andhra Pradesh' },
  { value: 'arunachal-pradesh', label: 'Arunachal Pradesh' },
  { value: 'assam', label: 'Assam' },
  { value: 'bihar', label: 'Bihar' },
  { value: 'chhattisgarh', label: 'Chhattisgarh' },
  { value: 'goa', label: 'Goa' },
  { value: 'gujarat', label: 'Gujarat' },
  { value: 'haryana', label: 'Haryana' },
  { value: 'himachal-pradesh', label: 'Himachal Pradesh' },
  { value: 'jharkhand', label: 'Jharkhand' },
  { value: 'karnataka', label: 'Karnataka' },
  { value: 'kerala', label: 'Kerala' },
  { value: 'madhya-pradesh', label: 'Madhya Pradesh' },
  { value: 'maharashtra', label: 'Maharashtra' },
  { value: 'manipur', label: 'Manipur' },
  { value: 'meghalaya', label: 'Meghalaya' },
  { value: 'mizoram', label: 'Mizoram' },
  { value: 'nagaland', label: 'Nagaland' },
  { value: 'odisha', label: 'Odisha' },
  { value: 'punjab', label: 'Punjab' },
  { value: 'rajasthan', label: 'Rajasthan' },
  { value: 'sikkim', label: 'Sikkim' },
  { value: 'tamil-nadu', label: 'Tamil Nadu' },
  { value: 'telangana', label: 'Telangana' },
  { value: 'tripura', label: 'Tripura' },
  { value: 'uttar-pradesh', label: 'Uttar Pradesh' },
  { value: 'uttarakhand', label: 'Uttarakhand' },
  { value: 'west-bengal', label: 'West Bengal' },
  { value: 'andaman-nicobar', label: 'Andaman and Nicobar Islands' },
  { value: 'chandigarh', label: 'Chandigarh' },
  { value: 'dadra-nagar-haveli', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { value: 'delhi', label: 'Delhi' },
  { value: 'jammu-kashmir', label: 'Jammu and Kashmir' },
  { value: 'ladakh', label: 'Ladakh' },
  { value: 'lakshadweep', label: 'Lakshadweep' },
  { value: 'puducherry', label: 'Puducherry' }
];