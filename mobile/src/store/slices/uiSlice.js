import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  /** Mirrors OS light/dark (`Appearance`); updated on launch and when the system theme changes. Not persisted. */
  systemAppearance: 'light',
  /** Persisted: `light` | `dark` | `system` — resolved with `selectTheme`. */
  themePreference: 'system',
  sidebarCollapsed: false,
  isMobileMenuOpen: false,
  isLoading: false,
  /** User-selected / GPS location (persisted). */
  location: {
    latitude: null,
    longitude: null,
    /** Display line (often "Area, City, State") */
    label: '',
    addressLine: '',
    /** From reverse geocode when available */
    area: '',
    city: '',
    state: '',
    source: null
  },
  /** Latest device GPS (not persisted). */
  lastGps: null,
  locationPickerOpen: false,
  modal: {
    isOpen: false,
    type: null,
    data: null
  }
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSystemAppearance: (state, action) => {
      const next = action.payload === 'dark' ? 'dark' : 'light';
      if (state.systemAppearance !== next) {
        state.systemAppearance = next;
      }
    },
    setThemePreference: (state, action) => {
      const v = String(action.payload || '').toLowerCase();
      if (v === 'light' || v === 'dark' || v === 'system') {
        state.themePreference = v;
      }
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = action.payload;
    },
    toggleMobileMenu: (state) => {
      state.isMobileMenuOpen = !state.isMobileMenuOpen;
    },
    setMobileMenuOpen: (state, action) => {
      state.isMobileMenuOpen = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    openModal: (state, action) => {
      state.modal = {
        isOpen: true,
        type: action.payload.type,
        data: action.payload.data || null
      };
    },
    closeModal: (state) => {
      state.modal = {
        isOpen: false,
        type: null,
        data: null
      };
    },
    setLocation: (state, action) => {
      const p = action.payload || {};
      state.location = {
        ...state.location,
        ...p
      };
    },
    setLastGps: (state, action) => {
      state.lastGps = action.payload;
    },
    openLocationPicker: (state) => {
      state.locationPickerOpen = true;
    },
    closeLocationPicker: (state) => {
      state.locationPickerOpen = false;
    }
  }
});

export const {
  setSystemAppearance,
  setThemePreference,
  toggleSidebar,
  setSidebarCollapsed,
  toggleMobileMenu,
  setMobileMenuOpen,
  setLoading,
  openModal,
  closeModal,
  setLocation,
  setLastGps,
  openLocationPicker,
  closeLocationPicker
} = uiSlice.actions;

export const selectThemePreference = (state) => state?.ui?.themePreference ?? 'system';

/** Resolved `light` | `dark` for UI (NativeWind `dark` class, StatusBar, tab bar). */
export const selectTheme = (state) => {
  const pref = selectThemePreference(state);
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return state?.ui?.systemAppearance === 'dark' ? 'dark' : 'light';
};

export const selectLocation = (state) => state?.ui?.location ?? initialState.location;
export const selectLocationLabel = (state) => {
  const l = state?.ui?.location;
  const area = String(l?.area || '').trim();
  const city = String(l?.city || '').trim();
  const st = String(l?.state || '').trim();
  const structured = [area, city, st].filter(Boolean).join(', ');
  if (structured) return structured;
  if (l?.label && String(l.label).trim()) return String(l.label).trim();
  if (l?.latitude != null && l?.longitude != null) {
    return `${Number(l.latitude).toFixed(3)}, ${Number(l.longitude).toFixed(3)}`;
  }
  return 'Select location';
};
export const selectLastGps = (state) => state?.ui?.lastGps ?? null;
export const selectLocationPickerOpen = (state) => Boolean(state?.ui?.locationPickerOpen);
export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed;
export const selectMobileMenuOpen = (state) => state.ui.isMobileMenuOpen;
export const selectGlobalLoading = (state) => state.ui.isLoading;
export const selectModal = (state) => state.ui.modal;

export default uiSlice.reducer;
