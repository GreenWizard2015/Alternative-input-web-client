import { useMemo } from 'react';
import GenericInputDialog from './GenericInputDialog';

type PlaceDialogProps = {
  cameraId: string;
  tempName: string;
  setTempName: (name: string) => void;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

export default function PlaceDialog({
  cameraId,
  tempName,
  setTempName,
  onConfirm,
  onCancel,
}: PlaceDialogProps) {
  const fields = useMemo(
    () => [
      {
        key: 'name',
        label: 'dialogs.enterPlaceName',
        value: tempName,
        onChange: setTempName,
      },
    ],
    [tempName, setTempName]
  );

  const handleConfirm = (values: { name: string }) => {
    // Add camera prefix to place name
    const prefixedName = `${cameraId} | ${values.name}`;
    onConfirm(prefixedName);
  };

  return <GenericInputDialog fields={fields} onConfirm={handleConfirm} onCancel={onCancel} />;
}
