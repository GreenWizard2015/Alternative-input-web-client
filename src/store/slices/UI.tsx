import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UUIDed, validate } from "../../components/Samples";

interface UIState {
  webcamId: string | null;
  userId: string,
  placeId: string,

  users: UUIDed[];
  places: UUIDed[];
};

const initialState: UIState = {
  webcamId: null,
  userId: '',
  placeId: '',
  users: [],
  places: [],
};

export const UISlice = createSlice({
  name: "UI",
  initialState,
  reducers: {
    setWebcamId: (state, action: PayloadAction<string | null>) => {
      state.webcamId = action.payload;
    },
    setUser: (state, action: PayloadAction<UUIDed>) => {
      state.userId = action.payload.uuid;
      // add user to list if not already there
      if (!state.users.find(u => u.name === action.payload.name)) {
        state.users.push(action.payload);
      }
      state.users = state.users.filter(validate);
    },
    setPlace: (state, action: PayloadAction<UUIDed>) => {
      state.placeId = action.payload.uuid;
      // add place to list if not already there
      if (action.payload && !state.places.find(p => p.name === action.payload.name)) {
        state.places.push(action.payload);
      }
      state.places = state.places.filter(validate);
    },
    incrementStats: (state, action) => {
      const { userId, placeId, count } = action.payload;      
      const places = state.places.map(p => {
        if (p.uuid === placeId) {
          if(typeof p.samples !== 'number') {
            p.samples = 0;
          }
          return { ...p, samples: p.samples + count };
        }
        return p;
      });
      const users = state.users.map(u => {
        if (u.uuid === userId) {
          if(typeof u.samples !== 'number') {
            u.samples = 0;
          }
          return { ...u, samples: u.samples + count };
        }
        return u;
      });

      state.places = places;
      state.users = users;
    },
    removeUser: (state, action: PayloadAction<string>) => {
      state.users = state.users.filter(u => u.uuid !== action.payload);
      state.userId = '';
    },
    removePlace: (state, action: PayloadAction<string>) => {
      state.places = state.places.filter(p => p.uuid !== action.payload);
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
  },
});

export const { 
  setWebcamId, setUser, setPlace, removeUser, removePlace, resetUser, resetPlace 
} = UISlice.actions;
export const { incrementStats } = UISlice.actions;
export default UISlice;