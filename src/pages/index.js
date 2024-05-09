import React from 'react';
import App from '../components/App';
import DataWorker from '../components/DataWorker';
import WindowDimensions from '../components/WindowDimensions';
import { incrementStats } from '../store/slices/UI';
import { connect } from 'react-redux';

const HomePage = ({ incrementStats }) => {
  return (
      <>
        <WindowDimensions />
        <DataWorker incrementStats={incrementStats} />
        <App />
      </>
  );
};

export default connect(null, { incrementStats })(HomePage);