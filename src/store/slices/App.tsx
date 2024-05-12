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
  activeUploads: number;
};

const initialState: AppState = {
  mode: "intro",
  screen: null,
  activeUploads: 0,
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
    changeActiveUploads: (state, action: PayloadAction<number>) => {  
      state.activeUploads += action.payload;
    }
  },
});

export const { setMode, updateScreen, changeActiveUploads } = AppSlice.actions;
export default AppSlice;