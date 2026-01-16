import GenericInputDialog from './GenericInputDialog';

export type BaseDialogProps = {
  tempName: string;
  setTempName: (name: string) => void;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  nameLabelKey: string;
};

export default function BaseDialog({
  tempName,
  setTempName,
  onConfirm,
  onCancel,
  nameLabelKey,
}: BaseDialogProps) {
  const fields = [
    {
      key: 'name',
      label: nameLabelKey,
      value: tempName,
      onChange: setTempName,
    },
  ];

  return (
    <GenericInputDialog
      fields={fields}
      onConfirm={values => {
        onConfirm(values.name);
      }}
      onCancel={onCancel}
    />
  );
}
