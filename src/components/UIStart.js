import { CircleMovingMode } from '../modes/CircleMovingMode';
import { LookAtMode } from '../modes/LookAtMode';
import { SplineMode } from '../modes/SplineMode';
import React, { useState } from 'react';
import MiniGameController from '../modes/MiniGameController';
import NullController from '../modes/NullController';

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
  const [useGamification, setUseGamification] = useState(true);
  const gamificationNote = React.useMemo(() => {
    if (!useGamification) return null;


    return (
      <div style={{ color: 'red' }}>
        This mode includes elements of gamification. You need to press the keys that appear inside or near the circle. The keys are: Z, A, S, and X. If you press the correct key, the circle will turn red, and recordings will be saved.
      </div>
    );
  }, [useGamification]);
  const [controller, setController] = useState(new MiniGameController());
  React.useEffect(() => {
    if (useGamification) {
      setController(new MiniGameController());
    } else {
      setController(new NullController());
    }
  }, [useGamification]);

  switch (helpMode) {
    case 'lookAt':
      return (
        <div className="ui-help">
          <h1>LookAt mode</h1>
          <p>In this mode you should concentrate on the static red circle. Grey circle means inactive mode.</p>
          <p>This mode intended to stabilize gaze predictions.</p>
          {gamificationNote}
          <ul>
            <li>Esc - return to main menu</li>
            <li>P / Enter / Space - toggle pause</li>
          </ul>
          {augmentations}
          <button onClick={() => onStart(new LookAtMode(controller))}>Start</button>
          {back}
        </div>
      )

    case 'spline':
      return (
        <div className="ui-help">
          <h1>Spline mode</h1>
          <p>In this mode you should concentrate on the red circle and ignore others.</p>
          <p>This is the main mode of the application. It is intended to adjust gaze predictions in motion.</p>
          {gamificationNote}
          <ul>
            <li>Esc - return to main menu</li>
            <li>P / Enter / Space - toggle pause</li>
          </ul>
          {augmentations}
          <button onClick={() => onStart(new SplineMode(controller))}>Start</button>
          {back}
        </div>
      )

    case 'circleMoving':
      return (
        <div className="ui-help">
          <h1>Circle moving mode</h1>
          <p>In this mode you should concentrate on the red circle while it moving.</p>
          <p>This mode intended to stabilize gaze predictions in motion.</p>
          {gamificationNote}
          <div style={{ color: 'red' }}>
            Data collection is started after the first activation of the circle.
          </div>
          <ul>
            <li>Arrow Up - increase level of difficulty</li>
            <li>Arrow Down - decrease level of difficulty</li>
            <li>Esc - return to main menu</li>
            <li>P / Enter / Space - toggle pause</li>
          </ul>
          {augmentations}
          <button onClick={() => onStart(new CircleMovingMode(controller))}>Start</button>
          {back}
        </div>
      )

    default:
      return (
        <div className="ui-start">
          <button onClick={() => setHelpMode('spline')}>Spline Mode</button>
          <button onClick={() => setHelpMode('lookAt')}>Look At Mode</button>
          <button
            onClick={() => setHelpMode('circleMoving')}
            disabled={!useGamification}
          >Circle Moving Mode</button>
          <div>
            <label>
              <input type="checkbox" checked={useGamification} onChange={() => setUseGamification(!useGamification)} />
              Use gamification (disable <b>only</b> if you can't press the keys (Z, A, S, X).)
            </label>
          </div>
        </div>
      );
  }
}