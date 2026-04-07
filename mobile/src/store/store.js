import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setStore } from './storeRef';
import authReducer from './slices/authSlice';
import eventReducer from './slices/eventSlice';
import notificationReducer from './slices/notificationSlice';
import uiReducer from './slices/uiSlice';

const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  whitelist: ['user', 'token', 'isAuthenticated', 'needsOnboarding']
};

/** Drop legacy `theme` key; keep `themePreference` for user choice (light / dark / system). */
function migrateUiPersistState(state) {
  if (!state || typeof state !== 'object') return state;
  const { theme, ...rest } = state;
  return rest;
}

const uiPersistConfig = {
  key: 'ui-v3',
  storage: AsyncStorage,
  migrate: (state) => Promise.resolve(migrateUiPersistState(state)),
  whitelist: ['sidebarCollapsed', 'location', 'themePreference']
};

const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);
const persistedUiReducer = persistReducer(uiPersistConfig, uiReducer);

export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,
    events: eventReducer,
    notifications: notificationReducer,
    ui: persistedUiReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE']
      }
    })
});

export const persistor = persistStore(store);

setStore(store);

export default store;
