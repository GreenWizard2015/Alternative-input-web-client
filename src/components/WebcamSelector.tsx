import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import type { RootState } from '../store';
import { toggleCameraSelection, initializeCameras } from '../store/slices/App';
import { selectCameras, selectSelectedCameras } from '../store/selectors';
import CameraPlaceSelector from './CameraPlaceSelector';
import type { CameraEntity } from '../types/camera';

interface WebcamSelectorProps {
  cameras: Record<string, CameraEntity>;
  selectedCameras: CameraEntity[];
  fallbackPlaceId?: string;
  doInitializeCameras: (devices: Array<{ deviceId: string; label: string }>) => void;
  doToggleCameraSelection: (cameraId: string) => void;
  onAddPlace: (cameraId: string) => void;
}

function WebcamSelector({
  cameras,
  selectedCameras,
  fallbackPlaceId = '',
  doInitializeCameras,
  doToggleCameraSelection,
  onAddPlace,
}: WebcamSelectorProps) {
  const { t } = useTranslation();
  const [webcams, setWebcams] = useState<MediaDeviceInfo[]>([]);
  const initializeRef = useRef(false);

  useEffect(() => {
    // Only initialize once, on mount
    if (initializeRef.current) {
      return;
    }

    // Mark as initialized IMMEDIATELY to prevent re-running in Strict Mode
    initializeRef.current = true;

    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('[WebcamSelector] Found video devices:', videoDevices.length);
      setWebcams(videoDevices);

      // Initialize cameras in Redux
      doInitializeCameras(
        videoDevices.map(d => ({
          deviceId: d.deviceId,
          label: d.label,
        }))
      );
    }).catch((err: Error) => {
      console.error('[WebcamSelector] Failed to enumerate devices:', err);
    });
  }, [doInitializeCameras]);

  // Auto-select first camera if none are selected
  useEffect(() => {
    if (selectedCameras.length === 0 && webcams.length > 0) {
      const firstDeviceId = webcams[0].deviceId;
      const firstCamera = cameras[firstDeviceId];
      if (firstCamera && !firstCamera.isSelected) {
        console.log('[WebcamSelector] Auto-selecting first camera:', firstDeviceId);
        doToggleCameraSelection(firstDeviceId);
      }
    }
  }, [selectedCameras, webcams, cameras, doToggleCameraSelection]);

  return (
    <div className="webcam-selector">
      <div className="webcam-selector-list">
        {webcams.length === 0 ? (
          <div className="webcam-selector-empty">{t('webcam.noCameras')}</div>
        ) : (
          webcams.map((webcam, index) => {
            // Get camera config from cameras object
            const camera = cameras[webcam.deviceId];
            const isSelected = camera?.isSelected || false;
            const cameraPlaceId = camera?.placeId || fallbackPlaceId;

            return (
              <div key={webcam.deviceId} className="webcam-selector-item">
                <label className="webcam-selector-label">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => doToggleCameraSelection(webcam.deviceId)}
                  />
                  <span className={`webcam-selector-label-text${isSelected ? ' selected' : ''}`}>
                    {webcam.label || t('webcam.cameraLabel', { index: index + 1 })}
                  </span>
                </label>

                {isSelected && (
                  <div className="webcam-selector-place-wrapper">
                    <CameraPlaceSelector
                      cameraId={webcam.deviceId}
                      selectedPlaceId={cameraPlaceId}
                      onAddPlace={onAddPlace}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="webcam-selector-stats">
        {t('webcam.selected', { count: selectedCameras.length, plural: selectedCameras.length !== 1 ? 's' : '' })}
      </div>
    </div>
  );
}

export default connect(
  (state: RootState) => ({
    cameras: selectCameras(state),
    selectedCameras: selectSelectedCameras(state),
  }),
  {
    doInitializeCameras: initializeCameras,
    doToggleCameraSelection: toggleCameraSelection,
  }
)(WebcamSelector);
