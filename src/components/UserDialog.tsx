import BaseDialog from './BaseDialog';

type UserDialogProps = {
  tempName: string;
  setTempName: (name: string) => void;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

export default function UserDialog({
  tempName,
  setTempName,
  onConfirm,
  onCancel,
}: UserDialogProps) {
  return (
    <BaseDialog
      tempName={tempName}
      setTempName={setTempName}
      onConfirm={onConfirm}
      onCancel={onCancel}
      nameLabelKey="dialogs.enterUserName"
    />
  );
}
