import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type InputField = {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

type GenericInputDialogProps = {
  fields: InputField[];
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
};

export default function GenericInputDialog({
  fields,
  onConfirm,
  onCancel,
}: GenericInputDialogProps) {
  const { t } = useTranslation();

  const handleConfirm = () => {
    const values: Record<string, string> = {};
    fields.forEach(field => {
      values[field.key] = field.value;
    });
    onConfirm(values);
  };

  const isAnyEmpty = useMemo(() => fields.some(field => !field.value.trim()), [fields]);

  return (
    <>
      {fields.map(field => (
        <div key={field.key}>
          <span>{t(field.label)} </span>
          <input
            value={field.value}
            onInput={e => field.onChange((e.target as HTMLInputElement).value)}
          />
        </div>
      ))}
      <div>
        <button onClick={handleConfirm} disabled={isAnyEmpty}>
          {t('common.ok')}
        </button>
        <button className="ms-2" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </>
  );
}
