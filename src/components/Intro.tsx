import React from 'react';

interface PrivacyNoticeProps {
  onConfirm: () => void; // Функция, которая вызывается при подтверждении
}

const Intro: React.FC<PrivacyNoticeProps> = ({ onConfirm }) => {
  return (
    <div id="UI">
      <div className="UI-wrapper">
        <h2>Privacy Notice</h2>
        <p>This application does not collect any personal data. Names and titles are used solely for convenience and only unique identifiers are stored.</p>
        <p>Data collection should be conducted with a static camera (tablets or mobile devices are not suitable). It is recommended to perform sessions in 10-minute intervals to prevent eye fatigue and maintain focus.</p>
        <button onClick={onConfirm}>
          I Understand
        </button>
      </div>
    </div>
  );
};

export default Intro;
export { Intro };
