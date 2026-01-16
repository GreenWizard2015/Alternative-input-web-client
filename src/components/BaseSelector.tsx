import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entity } from '../types/entities';

export type BaseSelectorProps<T extends Entity> = {
  selectedId: string;
  items: T[] & { byId: (id: string) => T | undefined };
  onSelect: (item: T | null) => void;
  onAdd: () => void;
  onRemove: () => void;
  onRecreate: () => void;
  labelKey: string;
  renderItemLabel: (item: T) => string;
  canRemove?: (item: T) => boolean;
  notSelectedKey?: string;
  confirmRemoveKey?: string;
  confirmRecreateKey?: string;
  showRecreate?: boolean;
};

export default function BaseSelector<T extends Entity>({
  selectedId,
  items,
  onSelect,
  onAdd,
  onRemove,
  onRecreate,
  labelKey,
  renderItemLabel,
  canRemove,
  notSelectedKey = 'menu.notSelected',
  confirmRemoveKey,
  confirmRecreateKey,
  showRecreate = true,
}: BaseSelectorProps<T>) {
  const { t } = useTranslation();

  const handleRemove = useCallback(() => {
    const item = items.byId(selectedId);
    if (!item) return;

    const confirmKey = confirmRemoveKey || `dialogs.confirmRemoveItem`;
    if (window.confirm(t(confirmKey, { name: item.name || selectedId }))) {
      onRemove();
    }
  }, [selectedId, items, t, onRemove, confirmRemoveKey]);

  const handleRecreate = useCallback(() => {
    const item = items.byId(selectedId);
    if (!item) return;

    const confirmKey = confirmRecreateKey || `dialogs.confirmRecreateItem`;
    if (window.confirm(t(confirmKey, { name: item.name || selectedId }))) {
      onRecreate();
    }
  }, [selectedId, items, t, onRecreate, confirmRecreateKey]);

  const currentItem = items.byId(selectedId);
  const canRemoveItem = currentItem && (canRemove ? canRemove(currentItem) : true);
  const canRecreate = currentItem && selectedId !== '';

  return (
    <div className="flex w100">
      {t(labelKey)}
      <select
        value={selectedId}
        className={!selectedId ? 'base-selector-unselected' : ''}
        onChange={e => {
          const value = e.target.value;
          if (value) {
            const item = items.byId(value);
            if (item) onSelect(item);
          } else {
            // Pass null to clear selection
            onSelect(null);
          }
        }}
      >
        <option value="">{t(notSelectedKey)}</option>
        {items.map(item => (
          <option key={item.uuid} value={item.uuid}>
            {renderItemLabel(item)}
          </option>
        ))}
      </select>
      <button className="flex-grow m5" onClick={onAdd}>
        {t('menu.add')}
      </button>
      <button className="flex-grow m5" disabled={!canRemoveItem} onClick={handleRemove}>
        {t('menu.remove')}
      </button>
      {showRecreate && (
        <button className="flex-grow m5" onClick={handleRecreate} disabled={!canRecreate}>
          {t('menu.recreate')}
        </button>
      )}
    </div>
  );
}
