import BaseDialog from './BaseDialog';

type MonitorDialogProps = {
  tempName: string;
  setTempName: (name: string) => void;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

export default function MonitorDialog({
  tempName,
  setTempName,
  onConfirm,
  onCancel,
}: MonitorDialogProps) {
  return (
    <BaseDialog
      tempName={tempName}
      setTempName={setTempName}
      onConfirm={onConfirm}
      onCancel={onCancel}
      nameLabelKey="dialogs.enterMonitorName"
    />
  );
}
