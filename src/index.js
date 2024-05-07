import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppStore } from './store';
import WindowDimensions from './components/WindowDimensions';
import DataWorker from './components/DataWorker';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppStore>
      <WindowDimensions />
      <DataWorker />
      <App />
    </AppStore>
  </React.StrictMode>
);