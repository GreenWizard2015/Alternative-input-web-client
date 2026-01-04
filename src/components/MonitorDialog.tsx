import BaseDialog from './BaseDialog';

type MonitorDialogProps = {
  tempName: string;
  setTempName: (name: string) => void;
  tempUUID: string;
  setTempUUID: (uuid: string) => void;
  onConfirm: (name: string, uuid: string) => void;
  onCancel: () => void;
};

export default function MonitorDialog({
  tempName,
  setTempName,
  tempUUID,
  setTempUUID,
  onConfirm,
  onCancel
}: MonitorDialogProps) {
  return (
    <BaseDialog
      tempName={tempName}
      setTempName={setTempName}
      tempUUID={tempUUID}
      setTempUUID={setTempUUID}
      onConfirm={onConfirm}
      onCancel={onCancel}
      nameLabelKey="dialogs.enterMonitorName"
      uuidLabelKey="dialogs.enterMonitorUUID"
    />
  );
}
