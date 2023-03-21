import React, { useState } from 'react';
import { useLocalStorageState } from '../utils/hooks';
import UIHelp from './UIHelp';
import UIStart from './UIStart';

const validateUser = ({ name, uuid }) => name.length > 0 && uuid.length > 0
const validatePlace = validateUser

export default function UI({
  onWebcamChange, goFullscreen, onStart,
  userId, onUserChange,
  placeId, onPlaceChange,
}) {
  const [subMenu, setSubMenu] = React.useState('');
  const [user, setUser] = useLocalStorageState('user', { name: '', uuid: '' })
  const [place, setPlace] = useLocalStorageState('place', { name: '', uuid: '' })
  const [tempName, setTempName] = useState('')

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
      case 'user':
        return <>
          <div>
            <span>Enter user name </span>
            <input value={tempName} onInput={e => setTempName(e.target.value)} />
          </div>
          <div>
            <button onClick={() => {
              setUser({ name: tempName, uuid: crypto.randomUUID() })
              setSubMenu('')
            }}>Ok</button>
            <button onClick={() => {
              setTempName('')
              setSubMenu('')
            }}>Cancel</button>
          </div>
        </>
      case 'place':
        return <>
          <div>
            <span>Enter place name </span>
            <input value={tempName} onInput={e => setTempName(e.target.value)} />
          </div>
          <div>
            <button onClick={() => {
              setPlace({ name: tempName, uuid: crypto.randomUUID() })
              setSubMenu('')
            }}>Ok</button>
            <button onClick={() => {
              setTempName('')
              setSubMenu('')
            }}>Cancel</button>
          </div>
        </>
      default:
        return (
          <>
            {/*
            <p>Webcamera:</p>
            <WebcamSelector onWebcamChange={onWebcamChange} /> 
          */}
            <p>User: {user.name}<button onClick={() => setSubMenu('user')}>{validateUser(user) ? 'Edit' : 'Create'}</button></p>
            <p>Place: {place.name}<button onClick={() => setSubMenu('place')}>{validatePlace(user) ? 'Edit' : 'Create'}</button></p>
            <button onClick={showHelp}>Help</button>
            <button onClick={() => setSubMenu('start')} disabled={!validateUser(user) || !validatePlace(place)}>Start</button>
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