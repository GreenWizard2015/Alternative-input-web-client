import { useState, useEffect } from 'react';

function WebcamSelector({ onWebcamChange }) {
  const [webcams, setWebcams] = useState<MediaDeviceInfo[]>([]);
  const [selectedWebcam, setSelectedWebcam] = useState('');
  // call onWebcamChange when the selected webcam changes
  useEffect(
    () => onWebcamChange(selectedWebcam),
    [selectedWebcam, onWebcamChange]
  );

  function handleWebcamChange(event) {
    const deviceId = event.target.value;
    setSelectedWebcam(deviceId);
  }

  function handleRefresh() {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setWebcams(videoDevices);
      setSelectedWebcam('');
    });
  }

  useEffect(handleRefresh, []); // call handleRefresh on mount

  return (
    <div className="webcam-selector">
      <label htmlFor="webcam-select">Select Webcam: </label>
      <select id="webcam-select" value={selectedWebcam} onChange={handleWebcamChange}>
        <option value="">--Select--</option>
        {webcams.map(webcam => (
          <option key={webcam.deviceId} value={webcam.deviceId}>{webcam.label}</option>
        ))}
      </select>
      <button onClick={handleRefresh}>Refresh</button>
    </div>
  );
}

export default WebcamSelector;
