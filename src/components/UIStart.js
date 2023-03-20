import { CircleMovingMode } from 'modes/CircleMovingMode';
import { CornerMode } from 'modes/CornerMode';
import { LookAtMode } from 'modes/LookAtMode';
import { SplineMode } from 'modes/SplineMode';
import React, { useState } from 'react';

// TODO: Write help for each mode (what to do, how to do it, keyboard shortcuts, etc.)
export default function UIStart({ onStart }) {
    const [helpMode, setHelpMode] = useState('');
    switch (helpMode) {
        case 'lookAt':
            return (
                <div className="ui-help">
                    <h1>LookAt mode</h1>
                    <p>In this mode you should concentrate on the red circle. Grey circle means inactive mode.</p>
                    <ul>
                        <li>Right Arrow - start next challenge</li>
                        <li>Esc - return to main menu</li>
                        <li>P / Enter - toggle pause</li>
                    </ul>
                    <button onClick={() => onStart(new LookAtMode())}>Start</button>
                </div>
            )

        case 'corner':
            return (
                <div className="ui-help">
                    <h1>Corner mode</h1>
                    <p>In this mode you should concentrate on the red circle and ignore others.</p>
                    <ul>
                        <li>Right Arrow - go to next corner</li>
                        <li>Right Arrow - go to previous corner</li>
                        <li>Esc - return to main menu</li>
                        <li>P / Enter - toggle pause</li>
                    </ul>
                    <button onClick={() => onStart(new CornerMode())}>Start</button>
                </div>
            )

        case 'spline':
            return (
                <div className="ui-help">
                    <h1>Spline mode</h1>
                    <p>In this mode you should concentrate on the red circle and ignore others.</p>
                    <ul>
                        <li>Esc - return to main menu</li>
                        <li>P / Enter - toggle pause</li>
                    </ul>
                    <button onClick={() => onStart(new SplineMode())}>Start</button>
                </div>
            )

        case 'circleMoving':
            return (
                <div className="ui-help">
                    <h1>CircleMoving mode</h1>
                    <p>In this mode you should concentrate on the red circle while it moving.</p>
                    <ul>
                        <li>Arrow Right - start new challenge</li>
                        <li>Arrow Up - increase level of difficulty</li>
                        <li>Arrow Right - decrease level of difficulty</li>
                        <li>Esc - return to main menu</li>
                        <li>P / Enter - toggle pause</li>
                    </ul>
                    <button onClick={() => onStart(new CircleMovingMode())}>Start</button>
                </div>
            )

        default:
            return (
                <div className="ui-help">
                    <div>
                        <button onClick={() => setHelpMode('lookAt')}>Look At Mode</button>
                    </div>
                    <div>
                        <button onClick={() => setHelpMode('corner')}>Corner Mode</button>
                    </div>
                    <div>
                        <button onClick={() => setHelpMode('spline')}>Spline Mode</button>
                    </div>
                    <div>
                        <button onClick={() => setHelpMode('circleMoving')}>Circle Moving Mode</button>
                    </div>
                </div>
            );
    }

}