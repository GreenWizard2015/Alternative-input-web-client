import React, { useState, useCallback, useMemo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import MiniGameController from '../modes/MiniGameController';
import NullController from '../modes/NullController';
import { AppMode } from '../modes/AppMode';
import { selectGoalSettings } from '../store/selectors';
import { renderSymbol } from '../types/Goal';
import type { RootState } from '../store';

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
  onBack: () => void;
  goalSettings: ReturnType<typeof selectGoalSettings>;
}

function UIStart({ onStart, onBack, goalSettings }: UIStartProps) {
  const { t } = useTranslation();
  const [helpMode, setHelpMode] = useState<string>('');
  const back: ReactNode = useMemo(
    () => (
      <button className="ms-2" onClick={() => setHelpMode('')}>
        {t('common.back')}
      </button>
    ),
    [t]
  );

  // Format symbols for display: "Z, A, S, X" or "Z, ↑, S, ←"
  const symbolsString = useMemo(() => {
    const displayed = goalSettings.symbols.map(renderSymbol);
    if (displayed.length === 1) return displayed[0];
    if (displayed.length === 2) return `${displayed[0]} or ${displayed[1]}`;
    return displayed.slice(0, -1).join(', ') + ` or ${displayed[displayed.length - 1]}`;
  }, [goalSettings.symbols]);
  const [useGamification, setUseGamification] = useState<boolean>(true);

  const createController = useCallback((): MiniGameController | NullController => {
    if (useGamification) {
      return new MiniGameController(goalSettings);
    }
    return new NullController(goalSettings);
  }, [useGamification, goalSettings]);

  const handleStartLookAt = useCallback(async () => {
    const Mode = await getLookAtMode();
    const controller = createController();
    const mode = new Mode(controller);
    onStart(mode);
  }, [createController, onStart]);

  const handleStartSpline = useCallback(async () => {
    const Mode = await getSplineMode();
    const controller = createController();
    const mode = new Mode(controller);
    onStart(mode);
  }, [createController, onStart]);

  const handleStartCircleMoving = useCallback(async () => {
    const Mode = await getCircleMovingMode();
    const controller = createController();
    const mode = new Mode(controller);
    onStart(mode);
  }, [createController, onStart]);

  switch (helpMode) {
    case 'lookAt':
      return (
        <div className="ui-help">
          <h1>{t('gameStart.lookAtMode')}</h1>
          <p>{t('gameStart.lookAtHelp')}</p>
          <p>{t('gameStart.lookAtPurpose')}</p>
          <button onClick={handleStartLookAt}>{t('common.start')}</button>
          {back}
        </div>
      );

    case 'spline':
      return (
        <div className="ui-help">
          <h1>{t('gameStart.splineMode')}</h1>
          <p>{t('gameStart.splineHelp')}</p>
          <p>{t('gameStart.splinePurpose')}</p>
          <button onClick={handleStartSpline}>{t('common.start')}</button>
          {back}
        </div>
      );

    case 'circleMoving': {
      return (
        <div className="ui-help">
          <h1>{t('gameStart.circleMovingMode')}</h1>
          <p>{t('gameStart.circleMovingHelp')}</p>
          <p>{t('gameStart.circleMovingPurpose')}</p>
          <div className="text-red">{t('gameStart.dataCollection')}</div>
          <button onClick={handleStartCircleMoving}>{t('common.start')}</button>
          {back}
        </div>
      );
    }
    default:
      return (
        <div className="ui-start">
          <button onClick={() => setHelpMode('spline')}>{t('gameStart.splineMode')}</button>
          <button onClick={() => setHelpMode('lookAt')}>{t('gameStart.lookAtMode')}</button>
          <button onClick={() => setHelpMode('circleMoving')}>
            {t('gameStart.circleMovingMode')}
          </button>
          <div>
            <label>
              <input
                type="checkbox"
                checked={useGamification}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUseGamification(e.target.checked)
                }
              />
              {t('gameStart.useGamification', { keys: symbolsString })}
            </label>
          </div>
          <button onClick={onBack} className="ms-2">
            {t('common.back')}
          </button>
        </div>
      );
  }
}

export default connect(
  (state: RootState) => ({
    goalSettings: selectGoalSettings(state),
  }),
  {}
)(UIStart);
