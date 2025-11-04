import React from 'react';
import './StepIndicator.css';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
  steps
}) => {
  return (
    <div className="step-indicator">
      <div className="step-indicator__header">
        <span className="step-indicator__text">
          Step {currentStep} of {totalSteps}
        </span>
      </div>
      <div className="step-indicator__steps">
        {steps.map((step, index) => (
          <div key={index} className="step-indicator__step">
            <div
              className={`step-indicator__circle ${
                index + 1 < currentStep
                  ? 'step-indicator__circle--completed'
                  : index + 1 === currentStep
                  ? 'step-indicator__circle--active'
                  : 'step-indicator__circle--pending'
              }`}
            >
              {index + 1 < currentStep ? '✓' : index + 1}
            </div>
            <span className={`step-indicator__label ${
              index + 1 === currentStep ? 'step-indicator__label--active' : ''
            }`}>
              {step}
            </span>
            {index < steps.length - 1 && (
              <div
                className={`step-indicator__line ${
                  index + 1 < currentStep ? 'step-indicator__line--completed' : ''
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
