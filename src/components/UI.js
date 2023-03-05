import React from 'react';

export default function UI({ onWebcamChange }) {
  const [helpActive, setHelpActive] = React.useState(false);

  function showHelp() {
    setHelpActive(true);
  }

  const content = helpActive ? (
    <div className="help">
      <h1>Help</h1>
      <p>
        This is a demo of the FaceDetector component. It uses the MediaPipe <br />
        FaceMesh model to detect facial landmarks in real time.
      </p>
    </div>
  ) : (
    <>
      {/* <WebcamSelector onWebcamChange={onWebcamChange} /> */}
      <button onClick={showHelp}>Help</button>
      <button>Start</button>
    </>
  );

  return (
    <div id="UI">
      <div className="UI-wrapper">
        {content}
      </div>
    </div>
  );
}