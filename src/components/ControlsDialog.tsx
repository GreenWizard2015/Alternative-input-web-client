import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { renderSymbol } from '../types/Goal';
import { LookAtMode } from '../modes/LookAtMode';
import { SplineMode } from '../modes/SplineMode';
import { CircleMovingMode } from '../modes/CircleMovingMode';
import { selectGoalSettings } from '../store/selectors';
import type { AppMode } from '../modes/AppMode';
import type { RootState } from '../store';

interface ControlsDialogProps {
  gameMode: AppMode;
  onConfirm: () => void;
  goalSettings: ReturnType<typeof selectGoalSettings>;
}

function ControlsDialog({ gameMode, onConfirm, goalSettings }: ControlsDialogProps) {
  const { t } = useTranslation();

  // Determine game mode type
  const modeType = useMemo(() => {
    if (gameMode instanceof LookAtMode) return 'lookAt';
    if (gameMode instanceof SplineMode) return 'spline';
    if (gameMode instanceof CircleMovingMode) return 'circleMoving';
    return 'unknown';
  }, [gameMode]);

  // Get mode-specific shortcuts
  const shortcuts = useMemo(() => {
    const baseShortcuts = t(`gameStart.keyboardShortcuts.${modeType}`, {
      returnObjects: true,
    }) as string[];

    // For CircleMoving mode: interpolate dynamic keys in keyboard shortcut
    if (modeType === 'circleMoving') {
      const displayed = goalSettings.symbols.map(renderSymbol);
      const keysString = displayed.join(' / ');
      const keysShortcut = baseShortcuts[3].replace('{{keys}}', keysString);

      return [
        baseShortcuts[0],
        baseShortcuts[1],
        baseShortcuts[2],
        keysShortcut,
        baseShortcuts[4],
        baseShortcuts[5],
      ];
    }

    return baseShortcuts;
  }, [modeType, goalSettings.symbols, t]);

  // Get dynamic keys string for gamification warning
  const keysString = useMemo(() => {
    const displayed = goalSettings.symbols.map(renderSymbol);
    if (displayed.length === 2) return `${displayed[0]} or ${displayed[1]}`;
    return displayed.slice(0, -1).join(', ') + ` or ${displayed[displayed.length - 1]}`;
  }, [goalSettings.symbols]);

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <h2>{t('gameStart.confirmTitle')}</h2>

        {/* Keyboard Shortcuts Section */}
        <div className="controls-section">
          <h3>{t('menu.help')}</h3>
          <ul>
            {shortcuts.map(shortcut => (
              <li key={shortcut}>{shortcut}</li>
            ))}
          </ul>
        </div>

        {/* Gamification Warning */}
        <div className="text-red">{t('gameStart.gamificationWarning', { keys: keysString })}</div>

        <div className="dialog-actions">
          <button onClick={onConfirm} className="btn-primary">
            {t('common.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Redux connection for goalSettings access
export default connect((state: RootState) => ({
  goalSettings: selectGoalSettings(state),
}))(ControlsDialog);
