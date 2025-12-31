import React from "react";
import { useTranslation } from "react-i18next";
import { connect } from "react-redux";
import { RootState } from "../store";
import { fromJSON } from "../store/json";
import type { UUIDed } from "../shared/Sample";

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
      <div className="w-100 d-flex">
        {sections}
      </div>
    </div>
  );
};

function GoalsProgress({ places }: { places: UUIDed[] }) {
  const { t } = useTranslation();

  // Calculate userSamples as the sum of all user samples
  const userSamples = (places || []).reduce((total: number, place: UUIDed) => {
    return total + (place.samples || 0);
  }, 0);

  // Calculate placeSamples as the sum of all place samples
  const placeSamples = (places || []).reduce((total: number, place: UUIDed) => {
    return total + (place.samples || 0);
  }, 0);
  return (
    <div className="w-100">
      {/* user samples */}
      <MultiLevelProgressBar
        currentValue={userSamples}
        levels={[
          { value: 50000, color: "lime", message: t('goalsProgress.userSamples.level1') },
          { value: 75000, color: "yellow", message: t('goalsProgress.userSamples.level2') },
          { value: 100000, color: "red", message: t('goalsProgress.userSamples.level3') }
        ]}
        higherLevelMessage={t('goalsProgress.userSamples.completed')}
      />
      {/* place samples */}
      <MultiLevelProgressBar
        currentValue={placeSamples}
        levels={[
          { value: 15000, color: "lime", message: t('goalsProgress.placeSamples.level1') },
          { value: 30000, color: "yellow", message: t('goalsProgress.placeSamples.level2') },
          { value: 50000, color: "red", message: t('goalsProgress.placeSamples.level3') }
        ]}
        higherLevelMessage={t('goalsProgress.placeSamples.completed')}
      />
    </div>
  );
}

export default connect(
  (state: RootState) => {
    // Parse places list from JSON string
    const places = fromJSON<UUIDed[]>(
      state.UI.places || '[]',
      []
    );

    return {
      places: places,
    };
  }
)(GoalsProgress);
