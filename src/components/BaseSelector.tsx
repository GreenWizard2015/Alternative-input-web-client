import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export type BaseSelectorProps<T extends { uuid: string }> = {
  selectedId: string;
  items: T[] & { byId: (id: string) => T | undefined };
  onSelect: (item: T) => void;
  onAdd: () => void;
  onRemove: () => void;
  onReset: () => void;
  labelKey: string;
  renderItemLabel: (item: T) => string;
  canRemove?: (item: T) => boolean;
  canReset?: (item: T) => boolean;
  notSelectedKey?: string;
  confirmRemoveKey?: string;
  confirmResetKey?: string;
};

export default function BaseSelector<T extends { uuid: string }>({
  selectedId,
  items,
  onSelect,
  onAdd,
  onRemove,
  onReset,
  labelKey,
  renderItemLabel,
  canRemove,
  canReset,
  notSelectedKey = 'menu.notSelected',
  confirmRemoveKey,
  confirmResetKey,
}: BaseSelectorProps<T>) {
  const { t } = useTranslation();

  const handleRemove = useCallback(() => {
    const item = items.byId(selectedId);
    if (!item) return;

    const confirmKey = confirmRemoveKey || `dialogs.confirmRemoveItem`;
    if (window.confirm(t(confirmKey, { name: (item as any).name || selectedId }))) {
      onRemove();
    }
  }, [selectedId, items, t, onRemove, confirmRemoveKey]);

  const handleReset = useCallback(() => {
    const item = items.byId(selectedId);
    if (!item) return;

    const confirmKey = confirmResetKey || `dialogs.confirmResetItem`;
    if (window.confirm(t(confirmKey, { name: (item as any).name || selectedId }))) {
      onReset();
    }
  }, [selectedId, items, t, onReset, confirmResetKey]);

  const currentItem = items.byId(selectedId);
  const canRemoveItem = currentItem && (canRemove ? canRemove(currentItem) : true);
  const canResetItem = currentItem && (canReset ? canReset(currentItem) : true);

  return (
    <div className='flex w100'>
      {t(labelKey)}
      <select
        value={selectedId}
        style={{ borderColor: !selectedId ? 'red' : undefined, borderWidth: !selectedId ? '2px' : undefined }}
        onChange={e => {
          const value = e.target.value;
          if (value) {
            const item = items.byId(value);
            if (item) onSelect(item);
          }
        }}>
        <option value="">{t(notSelectedKey)}</option>
        {items.map(item => (
          <option key={item.uuid} value={item.uuid}>
            {renderItemLabel(item)}
          </option>
        ))}
      </select>
      <button className='flex-grow m5' onClick={onAdd}>{t('menu.add')}</button>
      <button
        className='flex-grow m5'
        disabled={!canRemoveItem}
        onClick={handleRemove}
      >
        {t('menu.remove')}
      </button>
      <button className='flex-grow m5' disabled={!canResetItem} onClick={handleReset}>{t('menu.reset')}</button>
    </div>
  );
}
