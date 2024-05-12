import React from 'react';
import App from '../components/App';
import DataWorker from '../components/DataWorker';
import WindowDimensions from '../components/WindowDimensions';
import { incrementStats } from '../store/slices/UI';
import { connect } from 'react-redux';
import { changeActiveUploads } from '../store/slices/App';

const HomePage = ({ incrementStats, changeActiveUploads }) => {
  return (
      <>
        <WindowDimensions />
        <DataWorker incrementStats={incrementStats} changeActiveUploads={changeActiveUploads} />
        <App />
      </>
  );
};

export default connect(null, { incrementStats, changeActiveUploads })(HomePage);