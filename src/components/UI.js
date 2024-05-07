import React, { useState } from 'react';
import UIHelp from './UIHelp';
import UIStart from './UIStart';
import WebcamSelector from './WebcamSelector';
import { setUser, setPlace } from '../store/slices/UI';
import { connect } from 'react-redux';
import { validate } from '../Samples';

function UI({
  onWebcamChange, goFullscreen, onStart,
  userId, setUser,
  placeId, setPlace,
  users, places
}) {
  const [subMenu, setSubMenu] = React.useState('');
  const [tempName, setTempName] = useState('');
  users = users.filter(validate);
  places = places.filter(validate);

  function showHelp() {
    setSubMenu('help')
  }
  
  let content = null;
  if ('help' === subMenu) {
    content = <UIHelp onClose={() => setSubMenu('')} />
  } else if ('start' === subMenu) {
    content = <UIStart onStart={onStart} />
  } else if ('user' === subMenu) {
    content = <>
      <div>
        <span>Enter user name </span>
        <input value={tempName} onInput={e => setTempName(e.target.value)} />
      </div>
      <div>
        <button onClick={() => {
          setUser({ name: tempName, uuid: crypto.randomUUID() })
          setTempName('')
          setSubMenu('')
        }}>Ok</button>
        <button className='ms-2' onClick={() => {
          setTempName('')
          setSubMenu('')
        }}>Cancel</button>
      </div>
    </>
  } else if ('place' === subMenu) {
    content = <>
      <div>
        <span>Enter place name </span>
        <input value={tempName} onInput={e => setTempName(e.target.value)} />
      </div>
      <div>
        <button onClick={() => {
          setPlace({ name: tempName, uuid: crypto.randomUUID() })
          setTempName('')
          setSubMenu('')
        }}>Ok</button>
        <button  className='ms-2' onClick={() => {
          setTempName('')
          setSubMenu('')
        }}>Cancel</button>
      </div>
    </>
  } else {
    console.log({userId, placeId});
    content = <>
      <div>Webcamera:</div>
      <WebcamSelector onWebcamChange={onWebcamChange} />
      <div className='flex w100'>
        User: 
        {/* dropdown */}
        <select value={userId?.uuid} onChange={e => setUser(users.find(u => u.uuid === e.target.value))}>
          {users.map(u => <option key={u.uuid} value={u.uuid}>{u.name}</option>)}
        </select>
        <button className='flex-grow m5' onClick={() => setSubMenu('user')}>Add</button>
      </div>
      <div className='flex w100'>
        Place: 
        {/* dropdown */}
        <select value={placeId?.uuid} onChange={e => setPlace(places.find(p => p.uuid === e.target.value))}>
          {places.map(p => <option key={p.uuid} value={p.uuid}>{p.name}</option>)}
        </select>
        <button className='flex-grow m5' onClick={() => setSubMenu('place')}>Add</button>
      </div>

      <button className='w100' onClick={showHelp}>Help</button>
      <button className='w100' onClick={() => setSubMenu('start')} disabled={!validate(userId) || !validate(placeId)}>Start</button>
      <button className='w100' onClick={goFullscreen}>Fullscreen</button>
    </>
  }

  return (
    <div id="UI">
      <div className="UI-wrapper">
        {content}
      </div>
    </div>
  );
}

export default connect(
  state => ({
    userId: state.UI.userId,
    placeId: state.UI.placeId,
    users: state.UI.users || [],
    places: state.UI.places || []
  }),
  { setUser, setPlace }
)(UI)