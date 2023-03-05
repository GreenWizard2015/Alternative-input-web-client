import React from 'react';
import UIHelp from './UIHelp';

export default function UI({ onWebcamChange, goFullscreen }) {
  const [helpActive, setHelpActive] = React.useState(false);

  function showHelp() {
    setHelpActive(true);
  }

  const content = helpActive ? (
    <UIHelp onClose={() => setHelpActive(false)} />
  ) : (
    <>
      {/* <WebcamSelector onWebcamChange={onWebcamChange} /> */}
      <p>User:</p>
      <p>Webcamera:</p>
      <p>Place:</p>
      <button onClick={showHelp}>Help</button>
      <button>Start</button>
      <button onClick={goFullscreen}>Fullscreen</button>
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