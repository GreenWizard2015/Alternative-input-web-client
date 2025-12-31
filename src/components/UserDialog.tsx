import GenericInputDialog from './GenericInputDialog';

type UserDialogProps = {
  tempName: string;
  setTempName: (name: string) => void;
  tempUUID: string;
  setTempUUID: (uuid: string) => void;
  onConfirm: (name: string, uuid: string) => void;
  onCancel: () => void;
};

export default function UserDialog({
  tempName,
  setTempName,
  tempUUID,
  setTempUUID,
  onConfirm,
  onCancel
}: UserDialogProps) {
  const fields = [
    {
      key: 'name',
      label: 'dialogs.enterUserName',
      value: tempName,
      onChange: setTempName,
    },
    {
      key: 'uuid',
      label: 'dialogs.enterUserUUID',
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
