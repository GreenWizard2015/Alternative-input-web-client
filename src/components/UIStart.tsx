import React, { useState, useCallback, useMemo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [helpMode, setHelpMode] = useState<string>('');
  const back: ReactNode = useMemo(() => (
    <button className='ms-2' onClick={() => setHelpMode('')}>{t('common.back')}</button>
  ), [t]);
  const [useGamification, setUseGamification] = useState<boolean>(true);
  const gamificationNote: ReactNode = React.useMemo(() => {
    if (!useGamification) return null;

    return (
      <div style={{ color: 'red' }}>
        {t('gameStart.gamificationWarning')}
      </div>
    );
  }, [useGamification, t]);
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
          <h1>{t('gameStart.lookAtMode')}</h1>
          <p>{t('gameStart.lookAtHelp')}</p>
          <p>{t('gameStart.lookAtPurpose')}</p>
          {gamificationNote}
          <ul>
            {(t('gameStart.keyboardShortcuts.lookAt', { returnObjects: true }) as string[]).map((shortcut, index) => (
              <li key={index}>{shortcut}</li>
            ))}
          </ul>
          <button onClick={handleStartLookAt}>{t('common.start')}</button>
          {back}
        </div>
      )

    case 'spline':
      return (
        <div className="ui-help">
          <h1>{t('gameStart.splineMode')}</h1>
          <p>{t('gameStart.splineHelp')}</p>
          <p>{t('gameStart.splinePurpose')}</p>
          {gamificationNote}
          <ul>
            {(t('gameStart.keyboardShortcuts.spline', { returnObjects: true }) as string[]).map((shortcut, index) => (
              <li key={index}>{shortcut}</li>
            ))}
          </ul>
          <button onClick={handleStartSpline}>{t('common.start')}</button>
          {back}
        </div>
      )

    case 'circleMoving':
      return (
        <div className="ui-help">
          <h1>{t('gameStart.circleMovingMode')}</h1>
          <p>{t('gameStart.circleMovingHelp')}</p>
          <p>{t('gameStart.circleMovingPurpose')}</p>
          {gamificationNote}
          <div style={{ color: 'red' }}>
            {t('gameStart.dataCollection')}
          </div>
          <ul>
            {(t('gameStart.keyboardShortcuts.circleMoving', { returnObjects: true }) as string[]).map((shortcut, index) => (
              <li key={index}>{shortcut}</li>
            ))}
          </ul>
          <button onClick={handleStartCircleMoving}>{t('common.start')}</button>
          {back}
        </div>
      )

    default:
      return (
        <div className="ui-start">
          <button onClick={() => setHelpMode('spline')}>{t('gameStart.splineMode')}</button>
          <button onClick={() => setHelpMode('lookAt')}>{t('gameStart.lookAtMode')}</button>
          <button
            onClick={() => setHelpMode('circleMoving')}
          >{t('gameStart.circleMovingMode')}</button>
          <div>
            <label>
              <input type="checkbox" checked={useGamification} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUseGamification(e.target.checked)} />
              {t('gameStart.useGamification')}
            </label>
          </div>
        </div>
      );
  }
}
