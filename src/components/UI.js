import React from 'react';
import UIHelp from './UIHelp';
import UIStart from './UIStart';

export default function UI({
  onWebcamChange, goFullscreen, onStart,
  userId, onUserChange,
  placeId, onPlaceChange,
}) {
  // TODO: Implement user selection/creation. Use localStorage to store user id and their name. Use UUID library to generate user id. If user id is null, create new user id and name it "User dd.mm.yyyy hh:mm:ss".
  // TODO: Implement place creation. User can only create new places, not select existing ones. Use localStorage to store place id and their name. Use UUID library to generate place id. Literally just button "New place" that creates new place id and name it "dd.mm.yyyy hh:mm:ss". If place id is null, create new place id and name it "dd.mm.yyyy hh:mm:ss". If place id is not matched to any place, create new place id and name it "dd.mm.yyyy hh:mm:ss". In any case, just create new place id and name it "dd.mm.yyyy hh:mm:ss".
  const [subMenu, setSubMenu] = React.useState('');

  function showHelp() {
    setSubMenu('help')
  }

  const content = (() => {
    // TODO: use if statements instead of switch
    switch (subMenu) {
      case 'help':
        return <UIHelp onClose={() => setSubMenu('')} />
      case 'start':
        return <UIStart onStart={onStart} />
      default:
        return (
          <>
            {/*
            <p>Webcamera:</p>
            <WebcamSelector onWebcamChange={onWebcamChange} /> 
          */}
            <p>User:</p>
            <p>Place:</p>
            <button onClick={showHelp}>Help</button>
            <button onClick={() => setSubMenu('start')}>Start</button>
            <button onClick={goFullscreen}>Fullscreen</button>
          </>
        );
    }
  })();

  return (
    <div id="UI">
      <div className="UI-wrapper">
        {content}
      </div>
    </div>
  );
}