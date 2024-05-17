import React from 'react';

interface PrivacyNoticeProps {
  onConfirm: () => void;
}

const Intro: React.FC<PrivacyNoticeProps> = ({ onConfirm }) => {
  return (
    <>
      <h2>Privacy Notice</h2>
      <p>This application does not collect any personal data. Names and titles are used solely for convenience and only unique identifiers are stored.</p>
      <p>Data collection should be conducted with a static camera (tablets or mobile devices are not suitable). It is recommended to perform sessions in 10-minute intervals to prevent eye fatigue and maintain focus.</p>
      <h3>Instructions</h3>
      <ol>
        <li>Ensure that only one person is in the camera's field of view. Your eyes should be visible in the top left corner of the screen to ensure correct setup.</li>
        <li>Follow the red ball on the screen with your gaze. Small circular head movements are allowed, but try not to fix your head. Just move your head as usual in everyday life. Other objects on the screen are for augmentation and should be ignored.</li>
        <li>Create a new <strong>Place</strong> each time you change the position of the webcam, the window's location, or the distance to the screen.</li>
        <li>Create a new <strong>User</strong> for each person, as well as for the same person with and without glasses.</li>
        <li>Avoid distractions and do not resize the window during the session. If you feel tired or distracted, take a break. The app has a 3-second window during pauses when samples are ignored. Press pause as soon as possible to prevent bad data from entering the system if necessary.</li>
        <li>Do not turn off the app immediately after finishing. It needs time to send the data and will notify you when done.</li>
        <li>Conduct several short sessions throughout the day, lasting 5-15 minutes each. Perform sessions under different lighting conditions. Avoid overly long sessions to prevent system overload.</li>
        <li>Primarily use the spline mode (it is the simplest and most effective), but do not forget about the other modes as well.</li>
      </ol>
      <p style={{ color: "red", fontWeight: "bold" }}>
        <strong>Warning:</strong> This application is data-intensive and requires a high-speed internet connection for optimal performance.
      </p>
      <h3>Known Issues</h3>
      <ol>
        <li>Could be very slow due to the usage AI for face detection. Sadly, but could not be fixed.</li>
        <li>Couldn't run face detection in Safari. Please use Chrome, Edge or Firefox.</li>
      </ol>
 
      <button onClick={onConfirm}>
        I Understand
      </button>
    </>
  );
};

export default Intro;
export { Intro };
