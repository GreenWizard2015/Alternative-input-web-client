import React, { useState, useCallback, useMemo, ReactNode } from 'react';
import MiniGameController from '../modes/MiniGameController';
import NullController from '../modes/NullController';
import { AppMode } from '../modes/AppMode';

type GameModeConstructor = new (controller: MiniGameController | NullController) => AppMode;

// Game modes are lazily imported on demand to reduce initial bundle size
let CircleMovingMode: GameModeConstructor | null = null;
let LookAtMode: GameModeConstructor | null = null;
let SplineMode: GameModeConstructor | null = null;

// Lazy load game modes on first use
const getCircleMovingMode = async (): Promise<GameModeConstructor> => {
  if (!CircleMovingMode) {
    const { CircleMovingMode: Mode } = await import('../modes/CircleMovingMode');
    CircleMovingMode = Mode;
  }
  return CircleMovingMode;
};

const getLookAtMode = async (): Promise<GameModeConstructor> => {
  if (!LookAtMode) {
    const { LookAtMode: Mode } = await import('../modes/LookAtMode');
    LookAtMode = Mode;
  }
  return LookAtMode;
};

const getSplineMode = async (): Promise<GameModeConstructor> => {
  if (!SplineMode) {
    const { SplineMode: Mode } = await import('../modes/SplineMode');
    SplineMode = Mode;
  }
  return SplineMode;
};

interface UIStartProps {
  onStart: (mode: AppMode) => void;
}

export default function UIStart({ onStart }: UIStartProps) {
  const [helpMode, setHelpMode] = useState<string>('');
  const augmentations: ReactNode = useMemo(() => (
    <div className="ui-augmentations">
      <div className="mx-auto">
        <b>Augmentations</b>
      </div>
      <ul>
        <li>I - toggle random illumination</li>
        <li>B - toggle random background</li>
      </ul>
    </div>
  ), []);
  const back: ReactNode = useMemo(() => (
    <button className='ms-2' onClick={() => setHelpMode('')}>Back</button>
  ), []);
  const [useGamification, setUseGamification] = useState<boolean>(true);
  const gamificationNote: ReactNode = React.useMemo(() => {
    if (!useGamification) return null;

    return (
      <div style={{ color: 'red' }}>
        This mode includes elements of gamification. You need to press the keys that appear inside or near the circle. The keys are: Z, A, S, and X. If you press the correct key, the circle will turn red, and recordings will be saved.
      </div>
    );
  }, [useGamification]);
  const [controller, setController] = useState<MiniGameController | NullController>(new MiniGameController());
  React.useEffect(() => {
    if (useGamification) {
      setController(new MiniGameController());
    } else {
      setController(new NullController());
    }
  }, [useGamification]);

  const handleStartLookAt = useCallback(async () => {
    const Mode = await getLookAtMode();
    onStart(new Mode(controller));
  }, [controller, onStart]);

  const handleStartSpline = useCallback(async () => {
    const Mode = await getSplineMode();
    onStart(new Mode(controller));
  }, [controller, onStart]);

  const handleStartCircleMoving = useCallback(async () => {
    const Mode = await getCircleMovingMode();
    onStart(new Mode(controller));
  }, [controller, onStart]);

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
          <button onClick={handleStartLookAt}>Start</button>
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
          <button onClick={handleStartSpline}>Start</button>
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
          <button onClick={handleStartCircleMoving}>Start</button>
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
              <input type="checkbox" checked={useGamification} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUseGamification(e.target.checked)} />
              Use gamification (disable <b>only</b> if you can't press the keys (Z, A, S, X).)
            </label>
          </div>
        </div>
      );
  }
}
