import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { CameraConfig } from "../../types/camera";
import type { AppMode } from "../../modes/AppMode";
import { toJSON, fromJSON } from "../json";

type EAppMode = "menu" | "game" | "intro";
type DialogType = "IDLE" | "USER_DIALOG" | "PLACE_DIALOG" | "START_DIALOG" | "MONITOR_DIALOG" | "GAME_CONFIRM_DIALOG";

interface IScreen {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface AppState {
  // App UI state
  mode: EAppMode;
  screen: IScreen | null;
  activeUploads: number;
  meanUploadDuration: number;

  // Camera enumeration state (stored as JSON string, persisted via Redux Persist)
  cameras: string; // JSON string of Record<deviceId, CameraEntity>

  // Dialog state (ephemeral)
  dialogType: DialogType;
  tempName: string;
  tempCameraId: string;
  tempGameMode: AppMode | null;
}

const SMOOTHING_FACTOR = 0.9;
const initialState: AppState = {
  mode: "intro",
  screen: null,
  activeUploads: 0,
  meanUploadDuration: 0,
  cameras: JSON.stringify({}),
  dialogType: "IDLE",
  tempName: "",
  tempCameraId: "",
  tempGameMode: null,
};

interface IChangeActiveUploads {
  total: number;
  duration: number|null;
}

// NON-PERSISTED slice
// Contains both app UI state and camera enumeration state
export const AppSlice = createSlice({
  name: "App",
  initialState,
  reducers: {
    // ========== App UI Reducers ==========
    setMode: (state, action: PayloadAction<EAppMode>) => {
      state.mode = action.payload;
      state.dialogType = "IDLE";
    },
    updateScreen: (state, action: PayloadAction<IScreen>) => {
      state.screen = action.payload;
    },
    changeActiveUploads: (state, action: PayloadAction<IChangeActiveUploads>) => {
      console.log(action.payload);
      const { total, duration } = action.payload;
      state.activeUploads = total;
      if(null !== duration) {
        state.meanUploadDuration = SMOOTHING_FACTOR * state.meanUploadDuration + (1 - SMOOTHING_FACTOR) * duration;
      }
    },

    // ========== Camera Management Reducers ==========
    /**
     * Initialize or update cameras from enumeration
     */
    initializeCameras: (
      state,
      action: PayloadAction<Array<{ deviceId: string; label: string }>>
    ) => {
      const currentCameras = fromJSON<CameraConfig>(state.cameras, {});
      const newCameras: CameraConfig = {};
      action.payload.forEach(device => {
        // Preserve existing camera state if it exists
        const existing = currentCameras[device.deviceId];
        newCameras[device.deviceId] = existing || {
          deviceId: device.deviceId,
          label: device.label,
          isSelected: false,
          placeId: "",
        };
      });
      state.cameras = toJSON(newCameras);
    },

    /**
     * Toggle camera selection
     */
    toggleCameraSelection: (state, action: PayloadAction<string>) => {
      const deviceId = action.payload;
      const cameras = fromJSON<CameraConfig>(state.cameras, {});
      if (cameras[deviceId]) {
        cameras[deviceId].isSelected = !cameras[deviceId].isSelected;
        state.cameras = toJSON(cameras);
      }
    },

    /**
     * Set place for a camera
     */
    setCameraPlace: (
      state,
      action: PayloadAction<{ deviceId: string; placeId: string; placeName?: string }>
    ) => {
      const { deviceId, placeId, placeName } = action.payload;
      const cameras = fromJSON<CameraConfig>(state.cameras, {});
      if (cameras[deviceId]) {
        cameras[deviceId].placeId = placeId;
        if (placeName) {
          cameras[deviceId].placeName = placeName;
        }
        state.cameras = toJSON(cameras);
      }
    },

    /**
     * Remove camera from config
     */
    removeCamera: (state, action: PayloadAction<string>) => {
      const cameras = fromJSON<CameraConfig>(state.cameras, {});
      delete cameras[action.payload];
      state.cameras = toJSON(cameras);
    },

    /**
     * Replace entire camera config
     */
    updateCameraConfig: (state, action: PayloadAction<CameraConfig>) => {
      state.cameras = toJSON(action.payload);
    },

    /**
     * Clean up camera place references when a place is removed
     */
    cleanupPlaceFromCameras: (state, action: PayloadAction<string>) => {
      const placeId = action.payload;
      const cameras = fromJSON<CameraConfig>(state.cameras, {});
      Object.keys(cameras).forEach(deviceId => {
        if (cameras[deviceId].placeId === placeId) {
          cameras[deviceId].placeId = "";
          delete cameras[deviceId].placeName;
        }
      });
      state.cameras = toJSON(cameras);
    },

    // ========== Dialog State Reducers ==========
    openUserDialog: (state) => {
      state.dialogType = "USER_DIALOG";
      state.tempName = "";
    },

    openPlaceDialog: (state, action: PayloadAction<string | undefined>) => {
      state.dialogType = "PLACE_DIALOG";
      state.tempName = "";
      if (action.payload) {
        state.tempCameraId = action.payload;
      }
    },

    openMonitorDialog: (state) => {
      state.dialogType = "MONITOR_DIALOG";
      state.tempName = "";
    },

    openStartDialog: (state) => {
      state.dialogType = "START_DIALOG";
    },

    openGameConfirmDialog: (state, action: PayloadAction<AppMode>) => {
      state.dialogType = "GAME_CONFIRM_DIALOG";
      state.tempGameMode = action.payload;
    },

    closeDialog: (state) => {
      state.dialogType = "IDLE";
      state.tempName = "";
      state.tempCameraId = "";
      state.tempGameMode = null;
    },

    setTempName: (state, action: PayloadAction<string>) => {
      state.tempName = action.payload;
    },

    setTempCameraId: (state, action: PayloadAction<string>) => {
      state.tempCameraId = action.payload;
    },
  },
});

export const {
  setMode,
  updateScreen,
  changeActiveUploads,
  initializeCameras,
  toggleCameraSelection,
  setCameraPlace,
  removeCamera,
  updateCameraConfig,
  cleanupPlaceFromCameras,
  openUserDialog,
  openPlaceDialog,
  openMonitorDialog,
  openStartDialog,
  openGameConfirmDialog,
  closeDialog,
  setTempName,
  setTempCameraId,
} = AppSlice.actions;

export default AppSlice;