import React from 'react';

export default function UI({ onWebcamChange }) {
  const [helpActive, setHelpActive] = React.useState(false);

  function showHelp() {
    setHelpActive(true);
  }

  const content = helpActive ? (
    <div className="help">
      <p>Help</p>
      <button onClick={() => setHelpActive(false)}>Close</button>
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