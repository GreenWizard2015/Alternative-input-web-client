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
  meanUploadDuration: number;
  chunksOnServer: number;
};

const SMOOTHING_FACTOR = 0.9;
const initialState: AppState = {
  mode: "intro",
  screen: null,
  activeUploads: 0,
  meanUploadDuration: 0,
  chunksOnServer: 0,
};

interface IChangeActiveUploads {
  total: number;
  duration: number|null;
  chunks?: number;
};

// NON-PERSISTED slice
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
    changeActiveUploads: (state, action: PayloadAction<IChangeActiveUploads>) => {
      console.log(action.payload);
      const { total, duration, chunks } = action.payload;
      state.activeUploads = total;
      if(null !== duration) {
        state.meanUploadDuration = SMOOTHING_FACTOR * state.meanUploadDuration + (1 - SMOOTHING_FACTOR) * duration;
      }
      if(null !== chunks) {
        state.chunksOnServer = chunks;
      }
    }
  },
});

export const { setMode, updateScreen, changeActiveUploads } = AppSlice.actions;
export default AppSlice;