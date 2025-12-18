import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface WebcamSelectorProps {
  onWebcamChange: (selectedIds: string[]) => void;
  selectedCameraIds?: string[];
}

function WebcamSelector({ onWebcamChange, selectedCameraIds = [] }: WebcamSelectorProps) {
  const { t } = useTranslation();
  const [webcams, setWebcams] = useState<MediaDeviceInfo[]>([]);
  const [selectedWebcams, setSelectedWebcams] = useState<string[]>(selectedCameraIds);

  // Sync external selectedCameraIds prop changes
  useEffect(() => {
    if (selectedCameraIds && selectedCameraIds.length > 0) {
      setSelectedWebcams(selectedCameraIds);
    }
  }, [selectedCameraIds]);

  // call onWebcamChange when the selected webcams change
  useEffect(
    () => onWebcamChange(selectedWebcams),
    [selectedWebcams, onWebcamChange]
  );

  function handleWebcamToggle(deviceId: string) {
    setSelectedWebcams(prev => {
      if (prev.includes(deviceId)) {
        // Remove if already selected
        return prev.filter(id => id !== deviceId);
      } else {
        // Add if not selected
        return [...prev, deviceId];
      }
    });
  }

  function handleRefresh() {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setWebcams(videoDevices);
      // Auto-select first camera if none selected and cameras are available
      if (0 < videoDevices.length && selectedWebcams.length === 0) {
        setSelectedWebcams([videoDevices[0].deviceId]);
      }
    });
  }

  useEffect(handleRefresh, []); // call handleRefresh on mount

  return (
    <div className="webcam-selector">
      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
        {webcams.length === 0 ? (
          <div style={{ color: '#999' }}>{t('webcam.noCameras')}</div>
        ) : (
          webcams.map(webcam => (
            <div key={webcam.deviceId} style={{ marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedWebcams.includes(webcam.deviceId)}
                  onChange={() => handleWebcamToggle(webcam.deviceId)}
                  style={{ marginRight: '8px' }}
                />
                <span>{webcam.label || t('webcam.cameraLabel', { index: webcams.indexOf(webcam) + 1 })}</span>
              </label>
            </div>
          ))
        )}
      </div>
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
        {t('webcam.selected', { count: selectedWebcams.length, plural: selectedWebcams.length !== 1 ? 's' : '' })}
      </div>
    </div>
  );
}

export default WebcamSelector;
