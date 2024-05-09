import React from 'react';
import App from '../components/App';
import WindowDimensions from '../components/WindowDimensions';
import DataWorker from '../components/DataWorker';

const HomePage = () => {
  return (
      <>
        <WindowDimensions />
        <DataWorker />
        <App />
      </>
  );
};

export default HomePage;
