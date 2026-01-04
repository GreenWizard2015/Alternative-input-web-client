import GenericInputDialog from './GenericInputDialog';

export type BaseDialogProps = {
  tempName: string;
  setTempName: (name: string) => void;
  tempUUID: string;
  setTempUUID: (uuid: string) => void;
  onConfirm: (name: string, uuid: string) => void;
  onCancel: () => void;
  nameLabelKey: string;
  uuidLabelKey: string;
};

export default function BaseDialog({
  tempName,
  setTempName,
  tempUUID,
  setTempUUID,
  onConfirm,
  onCancel,
  nameLabelKey,
  uuidLabelKey,
}: BaseDialogProps) {
  const fields = [
    {
      key: 'name',
      label: nameLabelKey,
      value: tempName,
      onChange: setTempName,
    },
    {
      key: 'uuid',
      label: uuidLabelKey,
      value: tempUUID,
      onChange: setTempUUID,
    },
  ];

  return (
    <GenericInputDialog
      fields={fields}
      onConfirm={(values) => {
        const uuid = values.uuid || crypto.randomUUID();
        onConfirm(values.name, uuid);
      }}
      onCancel={onCancel}
    />
  );
}
