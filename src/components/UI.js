import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import UIStart from './UIStart';
import WebcamSelector from './WebcamSelector';
import { setUser, setPlace, removeUser, removePlace, resetUser, resetPlace, selectDefaultValues } from '../store/slices/UI';
import { connect } from 'react-redux';

function UI({
  onWebcamChange, goFullscreen, onStart, canStart, fps, cameraIds,
  userId, setUser,
  placeId, setPlace,
  users, places,
  doRemoveUser, doRemovePlace,
  resetUser, resetPlace,
  selectDefaultValues
}) {
  const { t } = useTranslation();
  const [subMenu, setSubMenu] = React.useState('');
  const [tempName, setTempName] = useState('');
  const [tempUUID, setTempUUID] = useState('');

  React.useEffect(() => {
    setTempUUID(crypto.randomUUID());
  }, [subMenu]);

  React.useEffect(() => {
    selectDefaultValues();
  }, [selectDefaultValues]);

  const removeUser = React.useCallback(() => {
    // confirm dialog
    const name = users.find(u => u.uuid === userId)?.name;
    const answer = window.confirm(
      t('dialogs.confirmRemoveUser', { name })
    );
    if (answer) {
      doRemoveUser({ uuid: userId});
    }
  }, [userId, users, doRemoveUser, t]);

  const removePlace = React.useCallback(() => {
    // confirm dialog
    const name = places.find(p => p.uuid === placeId)?.name;
    const answer = window.confirm(
      t('dialogs.confirmRemovePlace', { name })
    );
    if (answer) {
      doRemovePlace({ uuid: placeId });
    }
  }, [placeId, places, doRemovePlace, t]);
  
  let content = null;
  if ('start' === subMenu) {
    content = <UIStart onStart={onStart} />
  } else if ('user' === subMenu) {
    content = <>
      <div>
        <span>{t('dialogs.enterUserName')} </span>
        <input value={tempName} onInput={e => setTempName(e.target.value)} />
      </div>
      <div>
        <span>{t('dialogs.enterUserUUID')} </span>
        <input value={tempUUID} onInput={e => setTempUUID(e.target.value)} />
      </div>
      <div>
        <button onClick={() => {
          const uuid = tempUUID || crypto.randomUUID();
          setUser({ name: tempName, uuid, samples: 0 })
          setTempName('')
          setSubMenu('')
        }}>{t('common.ok')}</button>
        <button className='ms-2' onClick={() => {
          setTempName('')
          setSubMenu('')
        }}>{t('common.cancel')}</button>
      </div>
    </>
  } else if ('place' === subMenu) {
    content = <>
      <div>
        <span>{t('dialogs.enterPlaceName')} </span>
        <input value={tempName} onInput={e => setTempName(e.target.value)} />
      </div>
      <div>
        <button onClick={() => {
          setPlace({ name: tempName, uuid: crypto.randomUUID(), samples: 0 })
          setTempName('')
          setSubMenu('')
        }}>{t('common.ok')}</button>
        <button  className='ms-2' onClick={() => {
          setTempName('')
          setSubMenu('')
        }}>{t('common.cancel')}</button>
      </div>
    </>
  } else {
    content = <>
      <div>{t('webcam.label')}</div>
      <WebcamSelector onWebcamChange={onWebcamChange} selectedCameraIds={cameraIds} />
      <div className='flex w100'>
        {t('menu.user')}
        {/* dropdown */}
        <select value={userId} onChange={e => setUser(users.find(u => u.uuid === e.target.value))}>
          {users.map(u => <option key={u.uuid} value={u.uuid}>
            {u.name} ({u.samples} {t('menu.samples')})
            </option>)}
        </select>
        <button className='flex-grow m5' onClick={() => setSubMenu('user')}>{t('menu.add')}</button>
        <button className='flex-grow m5' onClick={removeUser}>{t('menu.remove')}</button>
        <button className='flex-grow m5' onClick={resetUser}>{t('menu.reset')}</button>
      </div>
      <div className='flex w100'>
        {t('menu.place')}
        {/* dropdown */}
        <select value={placeId} onChange={e => setPlace(places.find(p => p.uuid === e.target.value))}>
          {places.map(p => <option key={p.uuid} value={p.uuid}>
            {p.name} ({p.samples} {t('menu.samples')})
            </option>)}
        </select>
        <button className='flex-grow m5' onClick={() => setSubMenu('place')}>{t('menu.add')}</button>
        <button className='flex-grow m5' onClick={removePlace}>{t('menu.remove')}</button>
        <button className='flex-grow m5' onClick={resetPlace}>{t('menu.reset')}</button>
      </div>

      <button className='w100'
        onClick={() => setSubMenu('start')}
        disabled={!canStart || (userId === '') || (placeId === '')}
      >{t('common.start')}</button>
      <button className='w100' onClick={goFullscreen}>{t('menu.fullscreen')}</button>
    </>
  }

  return (
    <>
      <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '14px', color: 'black' }}>
        {cameraIds?.map((cameraId, index) => {
          const data = fps[cameraId];
          return (
            <div key={cameraId}>
              {t('fps.camera', { index, fps: data?.camera?.toFixed(2) || '0.00', samples: data?.samples?.toFixed(2) || '0.00' })}
            </div>
          );
        })}
      </div>
      {content}
    </>
  );
}

export default connect(
  state => ({
    userId: state.UI.userId,
    placeId: state.UI.placeId,
    users: state.UI.users || [],
    places: state.UI.places || [],
  }),
  { 
    setUser, setPlace, 
    doRemovePlace: removePlace, doRemoveUser: removeUser, 
    resetUser, resetPlace, selectDefaultValues
  }
)(UI)