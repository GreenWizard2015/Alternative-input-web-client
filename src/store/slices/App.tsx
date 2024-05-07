import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type EAppMode = "menu" | "game" | "intro";

interface IScreen {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface AppState {
  mode: EAppMode;
  screen: IScreen | null;
};

const initialState: AppState = {
  mode: "intro",
  screen: null,
};

export const AppSlice = createSlice({
  name: "App",
  initialState,
  reducers: {
    setMode: (state, action: PayloadAction<EAppMode>) => {
      state.mode = action.payload;
    },
    updateScreen: (state, action: PayloadAction<IScreen>) => {
      state.screen = action.payload;
    },
  },
});

export const { setMode, updateScreen } = AppSlice.actions;
export default AppSlice;