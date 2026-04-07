import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import eventService from '../../services/eventService';

const initialState = {
  events: [],
  currentEvent: null,
  upcomingEvents: [],
  featuredEvents: [],
  myEvents: [],
  pagination: {
    current: 1,
    pages: 1,
    total: 0
  },
  filters: {
    eventType: '',
    city: '',
    search: '',
    status: '',
    startDate: '',
    endDate: ''
  },
  isLoading: false,
  error: null
};

// Async thunks
export const fetchEvents = createAsyncThunk(
  'events/fetchEvents',
  async (params, { rejectWithValue }) => {
    try {
      const response = await eventService.getEvents(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch events');
    }
  }
);

export const fetchEventById = createAsyncThunk(
  'events/fetchEventById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await eventService.getEventById(id);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch event');
    }
  }
);

export const fetchUpcomingEvents = createAsyncThunk(
  'events/fetchUpcomingEvents',
  async (limit, { rejectWithValue }) => {
    try {
      const response = await eventService.getUpcomingEvents(limit);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch upcoming events');
    }
  }
);

export const fetchFeaturedEvents = createAsyncThunk(
  'events/fetchFeaturedEvents',
  async (_, { rejectWithValue }) => {
    try {
      const response = await eventService.getFeaturedEvents();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch featured events');
    }
  }
);

export const createEvent = createAsyncThunk(
  'events/createEvent',
  async (eventData, { rejectWithValue }) => {
    try {
      const response = await eventService.createEvent(eventData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create event');
    }
  }
);

export const updateEvent = createAsyncThunk(
  'events/updateEvent',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await eventService.updateEvent(id, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update event');
    }
  }
);

export const deleteEvent = createAsyncThunk(
  'events/deleteEvent',
  async (id, { rejectWithValue }) => {
    try {
      await eventService.deleteEvent(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete event');
    }
  }
);

export const registerForEvent = createAsyncThunk(
  'events/registerForEvent',
  async (eventId, { rejectWithValue }) => {
    try {
      const response = await eventService.registerForEvent(eventId);
      return { eventId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to register for event');
    }
  }
);

export const withdrawFromEvent = createAsyncThunk(
  'events/withdrawFromEvent',
  async (eventId, { rejectWithValue }) => {
    try {
      await eventService.withdrawFromEvent(eventId);
      return eventId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to withdraw from event');
    }
  }
);

const eventSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearCurrentEvent: (state) => {
      state.currentEvent = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Events
      .addCase(fetchEvents.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.isLoading = false;
        state.events = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch Event by ID
      .addCase(fetchEventById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEventById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentEvent = action.payload;
      })
      .addCase(fetchEventById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch Upcoming Events
      .addCase(fetchUpcomingEvents.fulfilled, (state, action) => {
        state.upcomingEvents = action.payload;
      })
      // Fetch Featured Events
      .addCase(fetchFeaturedEvents.fulfilled, (state, action) => {
        state.featuredEvents = action.payload;
      })
      // Create Event
      .addCase(createEvent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createEvent.fulfilled, (state, action) => {
        state.isLoading = false;
        state.events.unshift(action.payload);
      })
      .addCase(createEvent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update Event
      .addCase(updateEvent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateEvent.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.events.findIndex(e => e._id === action.payload._id);
        if (index !== -1) {
          state.events[index] = action.payload;
        }
        if (state.currentEvent?._id === action.payload._id) {
          state.currentEvent = action.payload;
        }
      })
      .addCase(updateEvent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete Event
      .addCase(deleteEvent.fulfilled, (state, action) => {
        state.events = state.events.filter(e => e._id !== action.payload);
      })
      // Register for Event
      .addCase(registerForEvent.fulfilled, (state, action) => {
        if (state.currentEvent?._id === action.payload.eventId) {
          state.currentEvent.isRegistered = true;
        }
      })
      // Withdraw from Event
      .addCase(withdrawFromEvent.fulfilled, (state, action) => {
        if (state.currentEvent?._id === action.payload) {
          state.currentEvent.isRegistered = false;
        }
      });
  }
});

export const { setFilters, clearFilters, clearCurrentEvent, clearError } = eventSlice.actions;

export const selectEvents = (state) => state.events.events;
export const selectCurrentEvent = (state) => state.events.currentEvent;
export const selectUpcomingEvents = (state) => state.events.upcomingEvents;
export const selectFeaturedEvents = (state) => state.events.featuredEvents;
export const selectEventPagination = (state) => state.events.pagination;
export const selectEventFilters = (state) => state.events.filters;
export const selectEventLoading = (state) => state.events.isLoading;
export const selectEventError = (state) => state.events.error;

export default eventSlice.reducer;
