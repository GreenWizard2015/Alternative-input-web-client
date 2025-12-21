import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import { AppStore } from './store';
import './i18n';
import './app.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <AppStore>
      <App />
    </AppStore>
  </React.StrictMode>
);
