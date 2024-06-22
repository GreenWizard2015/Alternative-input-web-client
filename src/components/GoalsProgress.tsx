import React from "react";
import { Container, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { RootState } from "../store";

// Utility function to clip values
function clip(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

type ILevelProps = {
  value: number;
  color: string;
  message: string;
};

interface IMultiLevelProgressBar {
  currentValue: number;
  levels: ILevelProps[];
  higherLevelMessage: string;
}

const MultiLevelProgressBar = ({ currentValue, levels, higherLevelMessage }: IMultiLevelProgressBar) => {
  // Calculate widths and values for each section
  const totalMax = levels[levels.length - 1].value;
  currentValue = clip(currentValue, 0, totalMax);
  let cumulativeValue = 0;

  const sections = levels.map((level, index) => {
    const previousMax = index === 0 ? 0 : levels[index - 1].value;
    const rng = level.value - previousMax;
    const sectionValue = clip(currentValue - previousMax, 0, rng);
    cumulativeValue += sectionValue;
    const active = (sectionValue > 0) || (0 === index);

    return (
      <div
        className="p-0 mx-0"
        key={index}
        style={{ 
          backgroundColor: "silver",
          width: `${(rng / totalMax) * 100}%`,
          height: "1.5rem",
          verticalAlign: "middle",
        }}
        >
        <div style={{ 
          verticalAlign: "middle",
          whiteSpace: "nowrap",
          backgroundColor: active ? level.color : "lime",
          width: `${(sectionValue / rng) * 100}%`,
        }}>
          {active ? `${cumulativeValue} / ${level.value}` : ""}
        </div>
      </div>
    );
  });

  // find the level that the user is in
  let message = "";
  for (let i = 0; i < levels.length; i++) {
    if (currentValue < levels[i].value) {
      message = levels[i].message;
      break;
    }
  }
  if (totalMax <= currentValue) {
    message = higherLevelMessage;
  }
  return (
    <div className="w-100">
      {message}
      <Row>
        {sections}
      </Row>
    </div>
  );
};

function GoalsProgress({ userSamples, placeSamples }) {
  return (
    <div className="w-100">
      {/* user samples */}
      <MultiLevelProgressBar
        currentValue={userSamples}
        levels={[
          { value: 50000, color: "lime", message: "Less than the minimum amount of samples for a single user. Keep going!" },
          { value: 75000, color: "blue", message: "Good job! The neural network has a chance to learn something about your face." },
          { value: 100000, color: "red", message: "Great! Almost the perfect amount of samples for training." }
        ]}
        higherLevelMessage="Good job! The neural network should be happy :) Consider changing the webcam position, wearing glasses, or asking a friend to help with further sample collection."
      />
      {/* place samples */}
      <MultiLevelProgressBar
        currentValue={placeSamples}
        levels={[
          { value: 15000, color: "lime", message: "Less than the minimum amount of samples for training. Keep going!" },
          { value: 30000, color: "blue", message: "Good job! The neural network has a chance to be trained." },
          { value: 50000, color: "red", message: "Great! Almost the perfect amount of samples for training." }
        ]}
        higherLevelMessage="Good job! The neural network should be happy :) Consider changing the webcam position, wearing glasses, or asking a friend to help with further sample collection."
      />
      {/* chunks on server */}
      <MultiLevelProgressBar
        currentValue={placeSamples}
        levels={[
          { value: 500, color: "lime", message: "Better than nothing, but still not enough samples for training. Keep going!" },
          { value: 1000, color: "blue", message: "There is a chance that the neural network will be able to learn something." },
          { value: 1500, color: "red", message: "Great! Almost the perfect amount of samples for training." }
        ]}
        higherLevelMessage="Good job! We are hit the perfect amount of samples for training. Now we can start training the neural network."
      />
    </div>
  );
}

export default connect(
  (state: RootState) => ({
    userSamples: state.UI.userSamples || 0,
    placeSamples: state.UI.placeSamples || 0,
    chunksOnServer: state.App.chunksOnServer || 0,
  })
)(GoalsProgress);
