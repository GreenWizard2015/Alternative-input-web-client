import React from 'react';
import UIHelp from './UIHelp';
import UIStart from './UIStart';

export default function UI({ onWebcamChange, goFullscreen, onStart }) {
  const [subMenu, setSubMenu] = React.useState('');

  function showHelp() {
    setSubMenu('help')
  }

  // I wish js has expression switch
  const content = (() => {
    switch (subMenu) {
      case 'help':
        return <UIHelp onClose={() => setSubMenu('')} />
      case 'start':
        return <UIStart onStart={onStart} />
      default:
        return <>
          {/* <WebcamSelector onWebcamChange={onWebcamChange} /> */}
          <p>User:</p>
          <p>Webcamera:</p>
          <p>Place:</p>
          <button onClick={showHelp}>Help</button>
          <button onClick={() => setSubMenu('start')}>Start</button>
          <button onClick={goFullscreen}>Fullscreen</button>
        </>
    }
  })()

  return (
    <div id="UI">
      <div className="UI-wrapper">
        {content}
      </div>
    </div>
  );
}