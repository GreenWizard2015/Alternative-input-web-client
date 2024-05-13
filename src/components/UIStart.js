import { CircleMovingMode } from '../modes/CircleMovingMode';
import { CornerMode } from '../modes/CornerMode';
import { LookAtMode } from '../modes/LookAtMode';
import { SplineMode } from '../modes/SplineMode';
import React, { useState } from 'react';

export default function UIStart({ onStart }) {
  const [helpMode, setHelpMode] = useState('');
  const augmentations = (
    <div className="ui-augmentations">
      <div className="mx-auto">
        <b>Augmentations</b>
      </div>
      <ul>
        <li>I - toggle random illumination</li>
        <li>B - toggle random background</li>
      </ul>
    </div>
  );
  const back = (
    <button className='ms-2' onClick={() => setHelpMode('')}>Back</button>
  );
  switch (helpMode) {
    case 'lookAt':
      return (
        <div className="ui-help">
          <h1>LookAt mode</h1>
          <p>In this mode you should concentrate on the static red circle. Grey circle means inactive mode.</p>
          <p>This mode intended to stabilize gaze predictions.</p>
          <ul>
            <li>Right Arrow - start next challenge</li>
            <li>Esc - return to main menu</li>
            <li>P / Enter / Space - toggle pause</li>
          </ul>
          {augmentations}
          <button onClick={() => onStart(new LookAtMode())}>Start</button>
          {back}
        </div>
      )

    case 'corner':
      return (
        <div className="ui-help">
          <h1>Corner mode</h1>
          <p>In this mode you should concentrate on the red circle and ignore others.</p>
          <p>This mode intended to adjust gaze predictions at the corners of the screen.</p>
          <ul>
            <li>Right Arrow - go to next corner</li>
            <li>Right Arrow - go to previous corner</li>
            <li>Esc - return to main menu</li>
            <li>P / Enter / Space - toggle pause</li>
          </ul>
          {augmentations}
          <button onClick={() => onStart(new CornerMode())}>Start</button>
          {back}
        </div>
      )

    case 'spline':
      return (
        <div className="ui-help">
          <h1>Spline mode</h1>
          <p>In this mode you should concentrate on the red circle and ignore others.</p>
          <p>This is the main mode of the application. It is intended to adjust gaze predictions in motion.</p>
          <ul>
            <li>Esc - return to main menu</li>
            <li>P / Enter / Space - toggle pause</li>
          </ul>
          {augmentations}
          <button onClick={() => onStart(new SplineMode())}>Start</button>
          {back}
        </div>
      )

    case 'circleMoving':
      return (
        <div className="ui-help">
          <h1>Circle moving mode</h1>
          <p>In this mode you should concentrate on the red circle while it moving.</p>
          <p>This mode intended to stabilize gaze predictions in motion.</p>
          <ul>
            <li>Arrow Right - start new challenge</li>
            <li>Arrow Up - increase level of difficulty</li>
            <li>Arrow Down - decrease level of difficulty</li>
            <li>Esc - return to main menu</li>
            <li>P / Enter / Space - toggle pause</li>
          </ul>
          {augmentations}
          <button onClick={() => onStart(new CircleMovingMode())}>Start</button>
          {back}
        </div>
      )

    default:
      return (
        <div className="ui-start">
          <button onClick={() => setHelpMode('spline')}>Spline Mode</button>
          <button onClick={() => setHelpMode('lookAt')}>Look At Mode</button>
          <button onClick={() => setHelpMode('corner')}>Corner Mode</button>
          <button onClick={() => setHelpMode('circleMoving')}>Circle Moving Mode</button>
        </div>
      );
  }

}