import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UUIDed, validate } from "Samples";

type EAppMode = "menu" | "game" | "intro";

interface IScreen {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface UIState {
  mode: EAppMode;
  webcamId: string | null;
  userId: UUIDed | null;
  placeId: UUIDed | null;

  users: UUIDed[];
  places: UUIDed[];
  screen: IScreen | null;
};

const initialState: UIState = {
  mode: "intro",
  webcamId: null,
  userId: null,
  placeId: null,
  users: [],
  places: [],
  screen: null,
};

export const UISlice = createSlice({
  name: "UI",
  initialState,
  reducers: {
    setMode: (state, action: PayloadAction<EAppMode>) => {
      state.mode = action.payload;
    },
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
    updateScreen: (state, action: PayloadAction<IScreen>) => {
      state.screen = action.payload;
    }
  },
});

export const { setMode, setWebcamId, setUser, setPlace, updateScreen } = UISlice.actions;
export default UISlice;