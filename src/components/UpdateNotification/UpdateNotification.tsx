import React from 'react';
import './UpdateNotification.css';

interface UpdateNotificationProps {
  onUpdate: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onUpdate }) => {
  return (
    <div className="update-overlay">
      <div className="update-modal">
        <h2>Update Available</h2>
        <p>A new version of SweatSync is available. Please update to ensure you have the latest features and improvements.</p>
        <button onClick={onUpdate} className="update-button">
          Update Now
        </button>
      </div>
    </div>
  );
};

export default UpdateNotification;