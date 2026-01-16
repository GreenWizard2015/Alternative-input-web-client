import React from 'react';
import { connect } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { Goal, GoalColors } from '../types/Goal';
import { GOAL_SYMBOL_MAX_LENGTH, ARROW_KEYS, renderSymbol } from '../types/Goal';
import { setGoalSettings } from '../store/slices/UI';
import { selectGoalSettings } from '../store/selectors';
import type { RootState } from '../store/index';
import { findDuplicateSymbolIndices } from '../utils/goalValidation';

interface GoalDialogProps {
  currentGoal: Goal;
  onClose: () => void;
  setGoalSettings: (goal: Goal) => void;
}

const GoalDialogComponent: React.FC<GoalDialogProps> = ({
  currentGoal,
  onClose,
  setGoalSettings: dispatchSetGoalSettings,
}) => {
  const { t } = useTranslation();

  // Create refs for symbol inputs to enable arrow key navigation
  const symbolInputRefs = React.useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  // Track which symbol indices have duplicates
  const [duplicateIndices, setDuplicateIndices] = React.useState<Set<number>>(new Set());

  // Direct Redux dispatch on every change (live settings)
  const handleSymbolChange = (index: number, symbol: string) => {
    if (index < 0 || index >= 4) return; // Bounds check
    // Uppercase and enforce max length
    const truncated = symbol.slice(0, GOAL_SYMBOL_MAX_LENGTH).toUpperCase();
    const newSymbols = [...currentGoal.symbols] as [string, string, string, string];
    newSymbols[index] = truncated;

    // Check for duplicates BEFORE Redux dispatch
    const duplicates = findDuplicateSymbolIndices(newSymbols);
    setDuplicateIndices(new Set(duplicates));

    dispatchSetGoalSettings({
      symbols: newSymbols,
      colors: currentGoal.colors,
      size: currentGoal.size,
    });
  };

  const handleColorChange = (state: keyof GoalColors, color: string) => {
    dispatchSetGoalSettings({
      symbols: currentGoal.symbols,
      colors: { ...currentGoal.colors, [state]: color },
      size: currentGoal.size,
    });
  };

  const handleSizeChange = (newSize: number) => {
    dispatchSetGoalSettings({
      symbols: currentGoal.symbols,
      colors: currentGoal.colors,
      size: newSize,
    });
  };

  // Handle keyboard key press to set symbol directly
  const handleSymbolKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    // Detect arrow key and assign it as the symbol
    const arrowName = ARROW_KEYS[event.key as keyof typeof ARROW_KEYS];
    if (arrowName) {
      event.preventDefault();
      const newSymbols = [...currentGoal.symbols] as [string, string, string, string];
      newSymbols[index] = arrowName;

      // Check for duplicates
      const duplicates = findDuplicateSymbolIndices(newSymbols);
      setDuplicateIndices(new Set(duplicates));

      dispatchSetGoalSettings({
        symbols: newSymbols,
        colors: currentGoal.colors,
        size: currentGoal.size,
      });
      return;
    }

    // Handle regular character input
    if (event.key.length === 1) {
      // Get the actual key pressed (handles shift, caps lock, etc.)
      const key = event.key.toUpperCase();
      handleSymbolChange(index, key);
      event.preventDefault(); // Prevent the character from being typed
    }
  };

  // Handle close with validation
  const handleClose = () => {
    if (duplicateIndices.size === 0) {
      onClose();
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <h2>{t('dialogs.goalSettings')}</h2>

        {/* COLORS (4 state-based color pickers) */}
        <div className="goal-section">
          <h3>{t('dialogs.colorsLabel')}</h3>

          <div className="colors-grid">
            {(['active', 'inactive', 'paused', 'text'] as const).map(colorKey => (
              <React.Fragment key={colorKey}>
                <div>
                  {t(`dialogs.color${colorKey.charAt(0).toUpperCase()}${colorKey.slice(1)}`)}
                </div>
                <input
                  type="color"
                  value={currentGoal.colors[colorKey]}
                  onChange={e => handleColorChange(colorKey, e.target.value)}
                />
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* SIZE SLIDER */}
        <div className="goal-section">
          <h3>{t('dialogs.sizeLabel')}</h3>

          <div className="size-control">
            <input
              type="range"
              min="50"
              max="300"
              value={currentGoal.size}
              onChange={e => handleSizeChange(Number(e.target.value))}
              className="size-slider"
            />
            <span className="size-value">{currentGoal.size}%</span>
          </div>
        </div>

        {/* SYMBOLS (4 character inputs) */}
        <div className="goal-section">
          <h3>{t('dialogs.symbolsLabel')}</h3>

          <div className="symbols-grid">
            {[0, 1, 2, 3].map(i => (
              <React.Fragment key={i}>
                <div>{t(`dialogs.symbol${i + 1}`)}</div>
                <input
                  ref={el => {
                    symbolInputRefs.current[i] = el;
                  }}
                  type="text"
                  value={renderSymbol(currentGoal.symbols[i])}
                  onChange={e => handleSymbolChange(i, e.target.value)}
                  onKeyDown={e => handleSymbolKeyDown(i, e)}
                  maxLength={GOAL_SYMBOL_MAX_LENGTH}
                  className={`symbol-input ${duplicateIndices.has(i) ? 'error' : ''}`}
                />
              </React.Fragment>
            ))}
          </div>

          {duplicateIndices.size > 0 && (
            <div className="error-message">{t('dialogs.symbolsUnique')}</div>
          )}
        </div>

        {/* Just close button - disabled when duplicates exist */}
        <button onClick={handleClose} className="button-close" disabled={duplicateIndices.size > 0}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
};

export default connect(
  (state: RootState) => ({
    currentGoal: selectGoalSettings(state),
  }),
  {
    setGoalSettings,
  }
)(GoalDialogComponent);
