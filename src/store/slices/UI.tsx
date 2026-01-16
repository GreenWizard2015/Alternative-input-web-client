import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { UUIDed } from '../../shared/Sample';
import { SampleValidation } from '../../shared/SampleValidation';
import { toJSON, fromJSON } from '../json';
import { cleanupPlaceFromCameras } from './App';
import type { Goal } from '../../types/Goal';
import { DEFAULT_GOAL } from '../../types/Goal';

interface UIState {
  userId: string;
  monitorId: string;

  // Stored as JSON strings - parse only when needed
  users: string; // JSON string of UUIDed[]
  places: string; // JSON string of UUIDed[]
  monitors: string; // JSON string of UUIDed[]
  goalSettings: string; // JSON string of Goal
}

const mainMonitorUUID = crypto.randomUUID();

const initialState: UIState = {
  userId: '',
  monitorId: mainMonitorUUID,
  users: JSON.stringify([]), // JSON string
  places: JSON.stringify([]), // JSON string
  monitors: JSON.stringify([
    {
      name: 'main',
      uuid: mainMonitorUUID,
      samples: 0,
    },
  ]),
  goalSettings: JSON.stringify(DEFAULT_GOAL), // JSON string of Goal
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
  name: 'UI',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<string | null>) => {
      // If null, clear selection
      if (action.payload === null) {
        state.userId = '';
        return;
      }

      // Parse users from JSON to find existing user by name
      const users: UUIDed[] = fromJSON(state.users, []);
      const existingUser = users.find(u => u.name === action.payload);

      if (existingUser) {
        // Select existing user - use their UUID
        state.userId = existingUser.uuid;
      } else {
        // New user - generate UUID and add to list
        const uuid = crypto.randomUUID();
        state.userId = uuid;
        users.push({ uuid, name: action.payload, samples: 0 });
        const filtered = users.filter(u => SampleValidation.validateUUIDed(u));
        state.users = toJSON(filtered);
      }
    },
    addPlace: (state, action: PayloadAction<string | null>) => {
      // If null, do nothing
      if (action.payload === null) {
        return;
      }

      // Just manage the places list - placeId is purely per-camera
      const places: UUIDed[] = fromJSON(state.places, []);
      const existingPlace = places.find(p => p.name === action.payload);

      if (!existingPlace) {
        // New place - generate UUID and add
        const uuid = crypto.randomUUID();
        places.push({ uuid, name: action.payload, samples: 0 });
        const filtered = places.filter(p => SampleValidation.validateUUIDed(p));
        state.places = toJSON(filtered);
      }
    },
    incrementStats: (state, action) => {
      const { userId, placeId, monitorId, count } = action.payload;
      // Parse JSON, update, serialize back
      let places: UUIDed[] = fromJSON(state.places, []);
      let users: UUIDed[] = fromJSON(state.users, []);
      let monitors: UUIDed[] = fromJSON(state.monitors, []);

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
        console.warn(
          `[incrementStats] Place NOT FOUND: ${placeId}, `,
          places.map(p => p.uuid)
        );
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
        console.warn(
          `[incrementStats] User NOT FOUND: ${userId}, `,
          users.map(u => u.uuid)
        );
      }

      // Update monitor if exists
      let monitorFound = false;
      monitors = monitors.map(m => {
        if (m.uuid === monitorId) {
          monitorFound = true;
          const newSamples = (m.samples || 0) + count;
          return { ...m, samples: newSamples };
        }
        return m;
      });

      // Log if monitor not found
      if (!monitorFound && monitorId) {
        console.warn(
          `[incrementStats] Monitor NOT FOUND: ${monitorId}, `,
          monitors.map(m => m.uuid)
        );
      }

      state.places = toJSON(places);
      state.users = toJSON(users);
      state.monitors = toJSON(monitors);
    },
    removeUser: (state, action: PayloadAction<{ uuid: string }>) => {
      const users: UUIDed[] = fromJSON(state.users, []);
      state.users = toJSON(users.filter(u => u.uuid !== action.payload.uuid));
      state.userId = '';
    },
    // recreate user - keep name, generate new uuid, clear samples
    recreateUser: state => {
      const users: UUIDed[] = fromJSON(state.users, []);
      state.users = toJSON(
        users.map(u => {
          if (u.uuid === state.userId) {
            const newUuid = crypto.randomUUID();
            state.userId = newUuid;
            return { ...u, uuid: newUuid, samples: 0 };
          }
          return u;
        })
      );
    },
    recreatePlace: (state, action: PayloadAction<{ uuid: string }>) => {
      // Recreate place - keep name, generate new uuid, clear samples
      const places: UUIDed[] = fromJSON(state.places, []);
      state.places = toJSON(
        places.map(p => {
          if (p.uuid === action.payload.uuid) {
            return { ...p, uuid: crypto.randomUUID(), samples: 0 };
          }
          return p;
        })
      );
    },

    // Monitor reducers (mirror user pattern)
    setMonitor: (state, action: PayloadAction<string | null>) => {
      // If null, clear selection
      if (action.payload === null) {
        state.monitorId = '';
        return;
      }

      // Parse monitors from JSON to find existing monitor by name
      const monitors: UUIDed[] = fromJSON(state.monitors, []);
      const existingMonitor = monitors.find(m => m.name === action.payload);

      if (existingMonitor) {
        // Select existing monitor - use their UUID
        state.monitorId = existingMonitor.uuid;
      } else {
        // New monitor - generate UUID and add to list
        const uuid = crypto.randomUUID();
        state.monitorId = uuid;
        monitors.push({ uuid, name: action.payload, samples: 0 });
        const filtered = monitors.filter(m => SampleValidation.validateUUIDed(m));
        state.monitors = toJSON(filtered);
      }
    },
    addMonitor: (state, action: PayloadAction<string | null>) => {
      // If null, do nothing
      if (action.payload === null) {
        return;
      }

      // Parse monitors from JSON, add if not already there, serialize back
      const monitors: UUIDed[] = fromJSON(state.monitors, []);
      const existingMonitor = monitors.find(m => m.name === action.payload);

      if (!existingMonitor) {
        // New monitor - generate UUID and add
        const uuid = crypto.randomUUID();
        monitors.push({ uuid, name: action.payload, samples: 0 });
        const filtered = monitors.filter(m => SampleValidation.validateUUIDed(m));
        state.monitors = toJSON(filtered);
      }
    },
    removeMonitor: (state, action: PayloadAction<{ uuid: string }>) => {
      const monitors: UUIDed[] = fromJSON(state.monitors, []);
      // Find the monitor to check if it's "main"
      const monitorToRemove = monitors.find(m => m.uuid === action.payload.uuid);
      // Prevent removal of "main" monitor
      if (monitorToRemove?.name === 'main') {
        console.warn('[removeMonitor] Cannot remove "main" monitor');
        return;
      }
      state.monitors = toJSON(monitors.filter(m => m.uuid !== action.payload.uuid));
      // Reset monitorId if removed monitor was selected
      if (state.monitorId === action.payload.uuid) {
        state.monitorId = '';
      }
    },
    recreateMonitor: (state, action: PayloadAction<{ uuid: string }>) => {
      // Recreate monitor - keep name, generate new uuid, clear samples
      const monitors: UUIDed[] = fromJSON(state.monitors, []);
      state.monitors = toJSON(
        monitors.map(m => {
          if (m.uuid === action.payload.uuid) {
            return { ...m, uuid: crypto.randomUUID(), samples: 0 };
          }
          return m;
        })
      );
    },

    selectDefaultValues: state => {
      const users: UUIDed[] = fromJSON(state.users, []);
      const places: UUIDed[] = fromJSON(state.places, []);
      let monitors: UUIDed[] = fromJSON(state.monitors, []);

      if (users.length > 0) {
        const user = users.find(u => u.uuid === state.userId);
        if (undefined === user) {
          // if user not found, select first user
          state.userId = users[0].uuid;
        }
        state.users = toJSON(users.filter(u => SampleValidation.validateUUIDed(u)));
      }
      if (places.length > 0) {
        state.places = toJSON(places.filter(p => SampleValidation.validateUUIDed(p)));
      }

      // Ensure "main" monitor exists - auto-add if empty
      if (monitors.length === 0) {
        const mainMonitorUUID = crypto.randomUUID();
        monitors = [
          {
            name: 'main',
            uuid: mainMonitorUUID,
            samples: 0,
          },
        ];
        state.monitorId = mainMonitorUUID;
      } else {
        // Auto-select "main" monitor if no monitor is selected
        if (!state.monitorId) {
          const mainMonitor = monitors.find(m => m.name === 'main');
          if (mainMonitor) {
            state.monitorId = mainMonitor.uuid;
          }
        }
      }

      state.monitors = toJSON(monitors.filter(m => SampleValidation.validateUUIDed(m)));
    },

    // Goal settings reducer (persistent)
    setGoalSettings: (state, action: PayloadAction<Goal>) => {
      state.goalSettings = toJSON(action.payload);
    },
  },
  extraReducers: builder => {
    builder.addCase(removePlace.fulfilled, (state, action) => {
      const placeId = action.payload;
      const places: UUIDed[] = fromJSON(state.places, []);
      state.places = toJSON(places.filter(p => p.uuid !== placeId));
    });
  },
});

export const {
  setUser,
  addPlace,
  removeUser,
  recreateUser,
  recreatePlace,
  setMonitor,
  addMonitor,
  removeMonitor,
  recreateMonitor,
  selectDefaultValues,
  setGoalSettings,
} = UISlice.actions;
export const { incrementStats } = UISlice.actions;
// removePlace is exported as a thunk (see above)
export default UISlice;
