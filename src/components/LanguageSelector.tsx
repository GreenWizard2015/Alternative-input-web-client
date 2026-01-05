import React from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageSelectorProps {
  inline?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ inline = false }) => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
  };

  const buttonBaseClasses = `language-selector-btn ${inline ? 'language-selector-btn-inline' : 'language-selector-btn-normal'}`;

  return (
    <div className="language-selector">
      <label className="language-selector-label">{t('intro.selectLanguage')}:</label>
      <div className="language-selector-buttons">
        <button
          onClick={() => handleLanguageChange('en')}
          className={`${buttonBaseClasses} ${i18n.language === 'en' ? 'language-selector-btn-active' : ''}`}
        >
          {t('common.english')}
        </button>
        <button
          onClick={() => handleLanguageChange('uk')}
          className={`${buttonBaseClasses} ${i18n.language === 'uk' ? 'language-selector-btn-active' : ''}`}
        >
          {t('common.ukrainian')}
        </button>
      </div>
    </div>
  );
};

export default LanguageSelector;
