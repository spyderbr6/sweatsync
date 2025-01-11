import React from 'react';
import './IOSInstructions.css';

interface IOSInstructionProps {
  onClose: () => void;
}

const IOSInstruction: React.FC<IOSInstructionProps> = ({ onClose }) => {
  return (
    <div className="ios-overlay">
      <div className="ios-modal">
        <h2>Add SweatSync to Home Screen</h2>
        <p>For the best experience on iOS, please add SweatSync to your home screen before continuing.</p>
        
        <div className="ios-steps">
          <li>Tap the share button <img src="/icons/ios-safari-addhomepage.png" alt="Share icon" style={{ height: '20px', verticalAlign: 'middle' }} /></li>
          <li>Scroll down and tap "Add to Home Screen"</li>
          <li>Tap "Add" in the top right corner</li>
          <li>Open SweatSync from your home screen</li>
        </div>

        <img 
          src="/add-to-homespage.png" 
          alt="Add to home screen instruction" 
          className="ios-image"
        />
        
        <button onClick={onClose} className="ios-button">
          I'll do it later
        </button>
      </div>
    </div>
  );
};

export default IOSInstruction;