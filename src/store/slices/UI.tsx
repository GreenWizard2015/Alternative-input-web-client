import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UUIDed, validate } from "../../components/Samples";

interface UIState {
  selectedCameraIds: string[]; // new multi-camera support
  userId: string,
  userSamples: number,
  placeId: string,
  placeSamples: number,

  users: UUIDed[];
  places: UUIDed[];
};

const initialState: UIState = {
  selectedCameraIds: [], // new multi-camera support
  userId: '',
  userSamples: 0,
  placeId: '',
  placeSamples: 0,
  users: [],
  places: [],
};
// PERSISTED slice
export const UISlice = createSlice({
  name: "UI",
  initialState,
  reducers: {
    setSelectedCameraIds: (state, action: PayloadAction<string[]>) => {
      state.selectedCameraIds = action.payload;
    },
    setUser: (state, action: PayloadAction<UUIDed>) => {
      state.userId = action.payload.uuid;
      // add user to list if not already there
      if (!state.users.find(u => u.name === action.payload.name)) {
        state.users.push(action.payload);
      }
      state.users = state.users.filter(validate);
      state.userSamples = state.users.find(u => u.uuid === state.userId)?.samples || 0;
    },
    setPlace: (state, action: PayloadAction<UUIDed>) => {
      state.placeId = action.payload.uuid;
      // add place to list if not already there
      if (action.payload && !state.places.find(p => p.name === action.payload.name)) {
        state.places.push(action.payload);
      }
      state.places = state.places.filter(validate);
      state.placeSamples = state.places.find(p => p.uuid === state.placeId)?.samples || 0;
    },
    incrementStats: (state, action) => {
      const { userId, placeId, count } = action.payload;      
      const places = state.places.map(p => {
        if (p.uuid === placeId) {
          if(typeof p.samples !== 'number') {
            p.samples = 0;
          }
          const newSamples = p.samples + count;
          state.placeSamples = newSamples;
          return { ...p, samples: newSamples };
        }
        return p;
      });
      const users = state.users.map(u => {
        if (u.uuid === userId) {
          if(typeof u.samples !== 'number') {
            u.samples = 0;
          }
          const newSamples = u.samples + count;
          state.userSamples = newSamples;
          return { ...u, samples: newSamples };
        }
        return u;
      });

      state.places = places;
      state.users = users;
    },
    removeUser: (state, action: PayloadAction<{ uuid: string }>) => {
      state.users = state.users.filter(u => u.uuid !== action.payload.uuid);
      state.userId = '';
    },
    removePlace: (state, action: PayloadAction<{ uuid: string }>) => {
      state.places = state.places.filter(p => p.uuid !== action.payload.uuid);
      state.placeId = '';
    },
    // reset samples for current user and place
    resetUser: (state) => {
      state.users = state.users.map(u => {
        if (u.uuid === state.userId) {
          return { ...u, samples: 0 };
        }
        return u;
      });
    },
    resetPlace: (state) => {
      state.places = state.places.map(p => {
        if (p.uuid === state.placeId) {
          return { ...p, samples: 0 };
        }
        return p;
      });
    },

    selectDefaultValues: (state) => {
      if (state.users.length > 0) {
        const user = state.users.find(u => u.uuid === state.userId);
        if (undefined === user) { // if user not found, select first user
          state.userId = state.users[0].uuid;
        }
        state.users = state.users.filter(validate);
      }
      if (state.places.length > 0) {
        const place = state.places.find(p => p.uuid === state.placeId);
        if (undefined === place) { // if place not found, select first place
          state.placeId = state.places[0].uuid;
        }
        state.places = state.places.filter(validate);
      }
    }
  },
});

export const {
  setSelectedCameraIds, setUser, setPlace, removeUser, removePlace, resetUser, resetPlace,
  selectDefaultValues
} = UISlice.actions;
export const { incrementStats } = UISlice.actions;
export default UISlice;