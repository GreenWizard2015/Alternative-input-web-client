import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import type { UUIDed } from "../../shared/Sample";
import { SampleValidation } from "../../shared/SampleValidation";
import { toJSON, fromJSON } from "../json";
import { cleanupPlaceFromCameras } from "./App";

interface UIState {
  userId: string,

  // Stored as JSON strings - parse only when needed
  users: string;              // JSON string of UUIDed[]
  places: string;             // JSON string of UUIDed[]
};

const initialState: UIState = {
  userId: '',
  users: JSON.stringify([]),           // JSON string
  places: JSON.stringify([]),          // JSON string
};

// Thunk action to remove place and cleanup cameras that reference it
export const removePlace = createAsyncThunk(
  'UI/removePlace',
  async (placeId: string, { dispatch }) => {
    // Cleanup camera references first
    dispatch(cleanupPlaceFromCameras(placeId));
    // Return placeId for reducer to remove from list
    return placeId;
  }
);

// PERSISTED slice
export const UISlice = createSlice({
  name: "UI",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<UUIDed>) => {
      state.userId = action.payload.uuid;
      // Parse users from JSON, add if not already there, serialize back
      const users: UUIDed[] = fromJSON(state.users);
      if (!users.find(u => u.name === action.payload.name)) {
        users.push(action.payload);
      }
      const filtered = users.filter(u => SampleValidation.validateUUIDed(u));
      state.users = toJSON(filtered);
    },
    setPlace: (state, action: PayloadAction<UUIDed>) => {
      // Just manage the places list - placeId is purely per-camera
      const places: UUIDed[] = fromJSON(state.places);
      if (action.payload && !places.find(p => p.name === action.payload.name)) {
        places.push(action.payload);
      }
      const filtered = places.filter(p => SampleValidation.validateUUIDed(p));
      state.places = toJSON(filtered);
    },
    incrementStats: (state, action) => {
      const { userId, placeId, count } = action.payload;
      // Parse JSON, update, serialize back
      let places: UUIDed[] = fromJSON(state.places);
      let users: UUIDed[] = fromJSON(state.users);

      // Update place if exists
      let placeFound = false;
      places = places.map(p => {
        if (p.uuid === placeId) {
          placeFound = true;
          const newSamples = (p.samples || 0) + count;
          return { ...p, samples: newSamples };
        }
        return p;
      });

      // Log if place not found
      if (!placeFound && placeId) {
        console.warn(`[incrementStats] Place NOT FOUND: ${placeId}, `, places.map(p => p.uuid));
      }

      // Update user if exists
      let userFound = false;
      users = users.map(u => {
        if (u.uuid === userId) {
          userFound = true;
          const newSamples = (u.samples || 0) + count;
          return { ...u, samples: newSamples };
        }
        return u;
      });

      // Log if user not found
      if (!userFound && userId) {
        console.warn(`[incrementStats] User NOT FOUND: ${userId}, `, users.map(u => u.uuid));
      }

      state.places = toJSON(places);
      state.users = toJSON(users);
    },
    removeUser: (state, action: PayloadAction<{ uuid: string }>) => {
      const users: UUIDed[] = fromJSON(state.users);
      state.users = toJSON(users.filter(u => u.uuid !== action.payload.uuid));
      state.userId = '';
    },
    // reset samples for current user
    resetUser: (state) => {
      const users: UUIDed[] = fromJSON(state.users);
      state.users = toJSON(users.map(u => {
        if (u.uuid === state.userId) {
          return { ...u, samples: 0 };
        }
        return u;
      }));
    },
    resetPlace: (state, action: PayloadAction<{ uuid: string }>) => {
      // Reset samples for a specific place
      const places: UUIDed[] = fromJSON(state.places);
      state.places = toJSON(places.map(p => {
        if (p.uuid === action.payload.uuid) {
          return { ...p, samples: 0 };
        }
        return p;
      }));
    },

    selectDefaultValues: (state) => {
      const users: UUIDed[] = fromJSON(state.users);
      const places: UUIDed[] = fromJSON(state.places);

      if (users.length > 0) {
        const user = users.find(u => u.uuid === state.userId);
        if (undefined === user) { // if user not found, select first user
          state.userId = users[0].uuid;
        }
        state.users = toJSON(users.filter(u => SampleValidation.validateUUIDed(u)));
      }
      if (places.length > 0) {
        state.places = toJSON(places.filter(p => SampleValidation.validateUUIDed(p)));
      }
    },

  },
  extraReducers: (builder) => {
    builder.addCase(removePlace.fulfilled, (state, action) => {
      const placeId = action.payload;
      const places: UUIDed[] = fromJSON(state.places);
      state.places = toJSON(places.filter(p => p.uuid !== placeId));
    });
  },
});

export const {
  setUser,
  setPlace,
  removeUser,
  resetUser,
  resetPlace,
  selectDefaultValues,
} = UISlice.actions;
export const { incrementStats } = UISlice.actions;
// removePlace is exported as a thunk (see above)
export default UISlice;