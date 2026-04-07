import { toast } from './toast';
import { getErrorMessage } from './helpers';

/**
 * Show error toast with user-friendly message
 * @param {Error|string} error - Error object or message string
 * @param {string} [fallbackMessage] - Optional fallback message if error parsing fails
 */
export const showError = (error, fallbackMessage) => {
  const message = typeof error === 'string' 
    ? error 
    : getErrorMessage(error) || fallbackMessage || 'Something went wrong';
  
  toast.error(message);
  
  // Log to console for debugging (in development)
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', error);
  }
  
  return message;
};

/**
 * Show success toast
 * @param {string} message - Success message
 */
export const showSuccess = (message) => {
  toast.success(message);
};

/**
 * Show info toast
 * @param {string} message - Info message
 */
export const showInfo = (message) => {
  toast.success(message);
};

/**
 * Show loading toast (returns toast id for dismissal)
 * @param {string} message - Loading message
 * @returns {string} - Toast ID to dismiss later
 */
export const showLoading = (message = 'Loading...') => {
  return toast.loading(message);
};

/**
 * Dismiss a specific toast or all toasts
 * @param {string} [toastId] - Specific toast ID or undefined to dismiss all
 */
export const dismissToast = (toastId) => {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
};

/**
 * Promise-based toast for async operations
 * @param {Promise} promise - Promise to track
 * @param {Object} messages - { loading, success, error }
 */
export const showPromiseToast = (promise, messages = {}) => {
  const defaultMessages = {
    loading: 'Processing...',
    success: 'Done!',
    error: (err) => getErrorMessage(err),
  };
  
  return toast.promise(promise, {
    loading: messages.loading || defaultMessages.loading,
    success: messages.success || defaultMessages.success,
    error: messages.error || defaultMessages.error,
  });
};

/**
 * Handle API call with automatic error handling
 * Wrapper for async API calls that shows toast on error
 * @param {Function} apiCall - Async function to execute
 * @param {Object} options - { showErrorToast, errorMessage, onError }
 * @returns {Promise<{data: any, error: Error|null}>}
 */
export const handleApiCall = async (apiCall, options = {}) => {
  const {
    showErrorToast = true,
    errorMessage = null,
    onError = null,
  } = options;

  try {
    const response = await apiCall();
    return { data: response?.data ?? response, error: null };
  } catch (error) {
    const message = errorMessage || getErrorMessage(error);
    
    if (showErrorToast) {
      showError(message);
    }
    
    if (onError && typeof onError === 'function') {
      onError(error, message);
    }
    
    return { data: null, error };
  }
};

export default {
  showError,
  showSuccess,
  showInfo,
  showLoading,
  dismissToast,
  showPromiseToast,
  handleApiCall,
};
