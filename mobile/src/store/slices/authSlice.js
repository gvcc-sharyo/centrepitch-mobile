import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authService from '../../services/authService';
import { needsAuthVerification } from '../../utils/authVerification';

/** Prefer API user shape (`isEmailVerified`); support legacy `emailVerified`. */
function readEmailVerifiedFromUser(user) {
  if (!user || typeof user !== 'object') return null;
  if (typeof user.isEmailVerified === 'boolean') return user.isEmailVerified;
  if (typeof user.emailVerified === 'boolean') return user.emailVerified;
  return null;
}

function readPhoneVerifiedFromUser(user) {
  if (!user || typeof user !== 'object') return null;
  if (typeof user.isPhoneVerified === 'boolean') return user.isPhoneVerified;
  if (typeof user.phoneVerified === 'boolean') return user.phoneVerified;
  return null;
}

function syncVerificationFromUser(state, user) {
  const ev = readEmailVerifiedFromUser(user);
  if (ev !== null) state.emailVerified = Boolean(ev);
  const pv = readPhoneVerifiedFromUser(user);
  if (pv !== null) state.phoneVerified = Boolean(pv);
}

const initialState = {
  user: null,
  token: null,
  /** Mobile: profile + sports onboarding after OTP/Google signup. */
  needsOnboarding: false,
  /** Data URI for profile image during mobile onboarding (not persisted). */
  mobileOnboardingProfilePhoto: null,
  /** After logout (or forced 401), next time public stack mounts start on Login instead of onboarding. */
  openLoginOnPublicMount: false,
  isAuthenticated: false,
  isPending: false,
  pendingRole: null,
  pendingStatus: null,
  kycStatus: null,
  needsEmailVerification: false,
  verificationEmail: null,
  verificationPhone: null,
  emailVerified: false,
  phoneVerified: false,
  isLoading: false,
  error: null
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      return response.data;
    } catch (error) {
      const data = error.response?.data;
      if (data?.code) {
        return rejectWithValue({
          code: data.code,
          message: data.message,
          data: data.data || null
        });
      }
      const errorMessage = data?.message || error.message || 'Invalid email or password. Please try again.';
      return rejectWithValue(errorMessage);
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
  }
);

export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (googleData, { rejectWithValue }) => {
    try {
      const response = await authService.googleAuth(googleData);
      return response.data;
    } catch (error) {
      const data = error.response?.data;
      if (data?.code) {
        return rejectWithValue({
          code: data.code,
          message: data.message,
          data: data.data || null
        });
      }
      return rejectWithValue(error.response?.data?.message || 'Google login failed');
    }
  }
);

export const getMe = createAsyncThunk(
  'auth/getMe',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getMe();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get user data');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const response = await authService.updateProfile(profileData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update profile');
    }
  }
);

export const updatePassword = createAsyncThunk(
  'auth/updatePassword',
  async (passwordData, { rejectWithValue }) => {
    try {
      const response = await authService.updatePassword(passwordData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update password');
    }
  }
);

export const verifyOTP = createAsyncThunk(
  'auth/verifyOTP',
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyOTP(email, otp);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Invalid or expired OTP');
    }
  }
);

export const verifyPhoneOTP = createAsyncThunk(
  'auth/verifyPhoneOTP',
  async ({ email, phone, otp }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyPhoneOTP({ email, phone, otp });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Invalid or expired phone OTP');
    }
  }
);

export const verifyMobileEmailOtp = createAsyncThunk(
  'auth/verifyMobileEmailOtp',
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyMobileEmailOtp({ email, otp });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Invalid or expired OTP');
    }
  }
);

export const completeMobileOnboarding = createAsyncThunk(
  'auth/completeMobileOnboarding',
  async (body, { rejectWithValue }) => {
    try {
      const response = await authService.completeMobileOnboarding(body);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Could not save profile');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.needsOnboarding = false;
      state.mobileOnboardingProfilePhoto = null;
      state.isPending = false;
      state.pendingRole = null;
      state.pendingStatus = null;
      state.kycStatus = null;
      state.error = null;
      state.openLoginOnPublicMount = true;
    },
    clearOpenLoginOnPublicMount: (state) => {
      state.openLoginOnPublicMount = false;
    },
    updatePendingKycStatus: (state, action) => {
      state.kycStatus = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearVerificationState: (state) => {
      state.needsEmailVerification = false;
      state.verificationEmail = null;
      state.verificationPhone = null;
      state.emailVerified = false;
      state.phoneVerified = false;
    },
    setVerificationRequired: (state, action) => {
      const payload = action.payload || {};
      state.needsEmailVerification = true;
      state.verificationEmail = payload.email || null;
      state.verificationPhone = payload.phone || null;
      state.emailVerified = Boolean(payload.emailVerified);
      state.phoneVerified = Boolean(payload.phoneVerified);
    },
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.openLoginOnPublicMount = false;
      if (typeof action.payload.needsOnboarding === 'boolean') {
        state.needsOnboarding = action.payload.needsOnboarding;
      }
    },
    setMobileOnboardingProfilePhoto: (state, action) => {
      state.mobileOnboardingProfilePhoto = action.payload || null;
    },
    clearMobileOnboardingProfilePhoto: (state) => {
      state.mobileOnboardingProfilePhoto = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.openLoginOnPublicMount = false;
        const payload = action.payload?.data ?? action.payload;
        state.user = payload;
        state.token = payload?.token || null;
        if (payload?.isPending) {
          state.isPending = true;
          state.pendingRole = payload.pendingRole;
          state.pendingStatus = payload.status;
          state.kycStatus = payload.kycStatus;
          state.isAuthenticated = false;
        } else {
          if (needsAuthVerification(payload)) {
            state.needsEmailVerification = true;
            state.verificationEmail = payload.email || null;
            state.verificationPhone = payload.phone || null;
          } else {
            state.needsEmailVerification = false;
            state.verificationEmail = null;
            state.verificationPhone = null;
          }
          syncVerificationFromUser(state, payload);
          state.isAuthenticated = true;
          state.isPending = false;
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.openLoginOnPublicMount = false;
        const payload = action.payload?.data ?? action.payload;
        if (payload?.needsVerification) {
          state.needsEmailVerification = true;
          state.verificationEmail = payload.email;
          state.verificationPhone = payload.phone || null;
          state.emailVerified = Boolean(payload.emailVerified);
          state.phoneVerified = Boolean(payload.phoneVerified);
          state.isAuthenticated = false;
        } else {
          state.user = payload;
          state.token = payload?.token || null;
          state.isAuthenticated = true;
        }
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Google Login
      .addCase(googleLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.openLoginOnPublicMount = false;
        const payload = action.payload?.data ?? action.payload;
        if (payload?.isNewUser && !payload?.token) {
          return;
        }
        state.needsOnboarding = Boolean(payload?.needsOnboarding);
        if (payload?.needsVerification) {
          state.needsOnboarding = false;
          state.needsEmailVerification = true;
          state.verificationEmail = payload.email;
          state.verificationPhone = payload.phone || null;
          syncVerificationFromUser(state, payload);
          state.isAuthenticated = false;
          return;
        }
        state.user = payload;
        state.token = payload?.token;
        if (payload?.isPending) {
          state.isPending = true;
          state.pendingRole = payload.pendingRole;
          state.pendingStatus = payload.status;
          state.kycStatus = payload.kycStatus;
          state.isAuthenticated = false;
        } else {
          state.isAuthenticated = true;
          state.isPending = false;
          syncVerificationFromUser(state, payload);
        }
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get Me
      .addCase(getMe.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.isLoading = false;
        const payloadUser = action.payload?.data ?? action.payload;
        state.user = { ...state.user, ...payloadUser };
        syncVerificationFromUser(state, payloadUser);
        if (typeof payloadUser?.needsOnboarding === 'boolean') {
          state.needsOnboarding = payloadUser.needsOnboarding;
        }
      })
      .addCase(getMe.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update Profile
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        const payloadUser = action.payload?.data ?? action.payload;
        state.user = { ...state.user, ...payloadUser };
        syncVerificationFromUser(state, payloadUser);
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update Password
      .addCase(updatePassword.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updatePassword.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(updatePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Verify OTP
      .addCase(verifyOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.openLoginOnPublicMount = false;
        const payload = action.payload?.data ?? action.payload;
        if (typeof payload?.needsOnboarding === 'boolean') {
          state.needsOnboarding = payload.needsOnboarding;
        }
        if (payload?.needsVerification || payload?.needsPhoneVerification) {
          state.needsEmailVerification = true;
          state.verificationEmail = payload.email || state.verificationEmail;
          state.verificationPhone = payload.phone || state.verificationPhone;
          syncVerificationFromUser(state, payload);
          // Keep existing authenticated session while showing optional/remaining verification prompts.
          state.isAuthenticated = Boolean(state.token);
          return;
        }
        state.user = payload;
        state.token = payload?.token || null;
        state.isAuthenticated = true;
        state.needsEmailVerification = false;
        state.verificationEmail = null;
        syncVerificationFromUser(state, payload);
        if (payload?.token) {
          localStorage.setItem('token', payload.token);
        }
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Verify phone OTP
      .addCase(verifyPhoneOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyPhoneOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.openLoginOnPublicMount = false;
        const payload = action.payload?.data ?? action.payload;
        if (typeof payload?.needsOnboarding === 'boolean') {
          state.needsOnboarding = payload.needsOnboarding;
        }
        if (payload?.needsVerification || payload?.needsEmailVerification) {
          state.needsEmailVerification = true;
          state.verificationEmail = payload.email || state.verificationEmail;
          state.verificationPhone = payload.phone || state.verificationPhone;
          syncVerificationFromUser(state, payload);
          // Keep existing authenticated session while showing optional/remaining verification prompts.
          state.isAuthenticated = Boolean(state.token);
          return;
        }
        state.user = payload;
        state.token = payload?.token || null;
        state.isAuthenticated = true;
        state.needsEmailVerification = false;
        state.verificationEmail = null;
        state.verificationPhone = null;
        syncVerificationFromUser(state, payload);
        if (payload?.token) {
          localStorage.setItem('token', payload.token);
        }
      })
      .addCase(verifyPhoneOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Mobile email OTP (passwordless)
      .addCase(verifyMobileEmailOtp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyMobileEmailOtp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.openLoginOnPublicMount = false;
        const payload = action.payload?.data ?? action.payload;
        state.user = payload;
        state.token = payload?.token || null;
        state.needsOnboarding = Boolean(payload?.needsOnboarding);
        state.isAuthenticated = true;
        state.needsEmailVerification = false;
        state.verificationEmail = null;
        state.verificationPhone = null;
        syncVerificationFromUser(state, payload);
      })
      .addCase(verifyMobileEmailOtp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(completeMobileOnboarding.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(completeMobileOnboarding.fulfilled, (state, action) => {
        state.isLoading = false;
        const payload = action.payload?.data ?? action.payload;
        state.user = { ...state.user, ...payload };
        syncVerificationFromUser(state, state.user);
        state.needsOnboarding = false;
        state.mobileOnboardingProfilePhoto = null;
      })
      .addCase(completeMobileOnboarding.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  }
});

export const {
  logout,
  clearError,
  clearVerificationState,
  setVerificationRequired,
  setCredentials,
  setMobileOnboardingProfilePhoto,
  clearMobileOnboardingProfilePhoto,
  updatePendingKycStatus,
  clearOpenLoginOnPublicMount,
} = authSlice.actions;

export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.token;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsPending = (state) => state.auth.isPending;
export const selectPendingRole = (state) => state.auth.pendingRole;
export const selectPendingStatus = (state) => state.auth.pendingStatus;
export const selectKycStatus = (state) => state.auth.kycStatus;
export const selectAuthLoading = (state) => state.auth.isLoading;
export const selectAuthError = (state) => state.auth.error;
export const selectNeedsEmailVerification = (state) => state.auth.needsEmailVerification;
export const selectVerificationEmail = (state) => state.auth.verificationEmail;
export const selectVerificationPhone = (state) => state.auth.verificationPhone;
export const selectEmailVerified = (state) => {
  const fromUser = readEmailVerifiedFromUser(state.auth.user);
  if (fromUser !== null) return Boolean(fromUser);
  return Boolean(state.auth.emailVerified);
};

export const selectOpenLoginOnPublicMount = (state) => Boolean(state.auth.openLoginOnPublicMount);
export const selectNeedsOnboarding = (state) => Boolean(state.auth.needsOnboarding);
export const selectMobileOnboardingProfilePhoto = (state) => state.auth.mobileOnboardingProfilePhoto;

export default authSlice.reducer;
