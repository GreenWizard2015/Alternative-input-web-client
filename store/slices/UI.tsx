import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UUIDed, validate } from "../../components/Samples";

interface UIState {
  webcamId: string | null;
  userId: UUIDed | null;
  placeId: UUIDed | null;

  users: UUIDed[];
  places: UUIDed[];
};

const initialState: UIState = {
  webcamId: null,
  userId: null,
  placeId: null,
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
      state.userId = action.payload;
      // add user to list if not already there
      if (!state.users.find(u => u.name === action.payload.name)) {
        state.users.push(action.payload);
      }
      state.users = state.users.filter(validate);
    },
    setPlace: (state, action: PayloadAction<UUIDed>) => {
      state.placeId = action.payload;
      // add place to list if not already there
      if (action.payload && !state.places.find(p => p.name === action.payload.name)) {
        state.places.push(action.payload);
      }
      state.places = state.places.filter(validate);
    },
  },
});

export const { setWebcamId, setUser, setPlace } = UISlice.actions;
export default UISlice;