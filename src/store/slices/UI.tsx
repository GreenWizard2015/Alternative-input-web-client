import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type EAppMode = "menu" | "game" | "intro";

interface UIState {
  mode: EAppMode;
  webcamId: string | null;
}

const initialState: UIState = {
  mode: "intro",
  webcamId: null,
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
  },
});

export const { setMode, setWebcamId } = UISlice.actions;
export default UISlice;