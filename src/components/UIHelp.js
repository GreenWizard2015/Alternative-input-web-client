import React from 'react';

export default function UIHelp({ onClose }) {
  return (
    <div className="ui-help">
      <h1>UI Help</h1>
      <p>Some help text</p>
      <button onClick={onClose}>Close</button>
    </div>
  );
}