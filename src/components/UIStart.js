import { CircleMovingMode } from 'modes/CircleMovingMode';
import { CornerMode } from 'modes/CornerMode';
import { LookAtMode } from 'modes/LookAtMode';
import { SplineMode } from 'modes/SplineMode';
import React from 'react';

// TODO: Implement help before start
// TODO: Write help for each mode (what to do, how to do it, keyboard shortcuts, etc.)
export default function UIStart({ onStart }) {
    return (
        <div className="ui-help">
            <button onClick={() => onStart(new LookAtMode())}>Look At Mode</button>
            <button onClick={() => onStart(new CornerMode())}>Corner Mode</button>
            <button onClick={() => onStart(new SplineMode())}>Spline Mode</button>
            <button onClick={() => onStart(new CircleMovingMode())}>Circle Moving Mode</button>
        </div>
    );
}