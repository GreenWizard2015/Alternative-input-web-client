import { useTranslation } from 'react-i18next';
import type { AggregatedStats } from './FaceDetectorWorkerManager';

type FPSDisplayProps = {
  fps: AggregatedStats | null;
};

export default function FPSDisplay({ fps }: FPSDisplayProps) {
  const { t } = useTranslation();

  if (!fps) return null;

  return (
    <div className="fps-display-container">
      {Array.from(fps.entries()).map(([cameraId, stats], index) => (
        <div key={cameraId} className="fps-display-item">
          <span>
            {t('fps.camera', {
              index,
              captureFps: stats.inputFps?.toFixed(2) || '0.00',
              processingFps: stats.processingFps?.toFixed(2) || '0.00',
              samples: stats.samplesTotal > 0 ? ` [${stats.samplesTotal}]` : ''
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
