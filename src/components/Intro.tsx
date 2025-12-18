import React from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';

interface PrivacyNoticeProps {
  onConfirm: () => void;
}

const Intro: React.FC<PrivacyNoticeProps> = ({ onConfirm }) => {
  const { t } = useTranslation();

  return (
    <>
      <div style={{ marginBottom: '20px' }}>
        <LanguageSelector inline={false} />
      </div>

      <h2>{t('intro.privacyNoticeTitle')}</h2>
      <p>{t('intro.privacyNoticeText')}</p>
      <p>{t('intro.dataCollectionInfo')}</p>
      <h3>{t('intro.instructionsTitle')}</h3>
      <ol>
        {(t('intro.instructions', { returnObjects: true }) as string[]).map((instruction, index) => (
          <li key={index}>{instruction}</li>
        ))}
      </ol>
      <p style={{ color: "red", fontWeight: "bold" }}>
        <strong>{t('intro.warningTitle')}:</strong> {t('intro.warningText')}
      </p>
      <h3>{t('intro.knownIssuesTitle')}</h3>
      <ol>
        {(t('intro.knownIssues', { returnObjects: true }) as string[]).map((issue, index) => (
          <li key={index}>{issue}</li>
        ))}
      </ol>
      <h3>{t('intro.finalNoteTitle')}</h3>
      <p>{t('intro.finalNoteText')}</p>

      <button onClick={onConfirm}>
        {t('intro.confirmButton')}
      </button>
    </>
  );
};

export default Intro;
export { Intro };
