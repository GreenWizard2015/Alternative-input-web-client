import React from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageSelectorProps {
  inline?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ inline = false }) => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const buttonStyle = inline
    ? { marginRight: '8px', padding: '4px 8px', fontSize: '12px' }
    : { marginRight: '8px', padding: '8px 16px' };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label style={{ fontWeight: 'bold' }}>{t('intro.selectLanguage')}:</label>
      <button
        onClick={() => handleLanguageChange('en')}
        style={{
          ...buttonStyle,
          backgroundColor: i18n.language === 'en' ? '#007bff' : '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: i18n.language === 'en' ? 'bold' : 'normal',
        }}
      >
        {t('common.english')}
      </button>
      <button
        onClick={() => handleLanguageChange('uk')}
        style={{
          ...buttonStyle,
          backgroundColor: i18n.language === 'uk' ? '#007bff' : '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: i18n.language === 'uk' ? 'bold' : 'normal',
        }}
      >
        {t('common.ukrainian')}
      </button>
    </div>
  );
};

export default LanguageSelector;
