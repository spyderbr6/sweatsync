// src/components/NotificationPreferences.tsx
import { useState } from 'react';
import { Bell, BellOff, Check, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useUser } from '../../userContext';

export function NotificationPreferences() {
  const { userId } = useUser();  // Get userId here instead
  const { permission, requestPermission, unsubscribe, error } = usePushNotifications(userId);
  const [showSuccess, setShowSuccess] = useState(false);

  // Handle enabling notifications
  const handleEnable = async () => {
    await requestPermission();
    if (permission === 'granted') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  // Handle disabling notifications
  const handleDisable = async () => {
    console.log('Disabling notifications for userId:', userId);
    await unsubscribe();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    console.log('Notifications disabled for userId:', userId);
  };

  return (
    <div className="profile-info-section">
      <h2 className="profile-section-title">Notification Preferences</h2>
      
      <div className="notification-status">
        <div className="notification-info">
          {permission === 'granted' ? (
            <Bell className="notification-icon notification-icon--enabled" />
          ) : (
            <BellOff className="notification-icon notification-icon--disabled" />
          )}
          <div className="notification-details">
            <span className="notification-label">
              Push Notifications
            </span>
            <span className="notification-status-text">
              {permission === 'granted' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        <button
          onClick={permission === 'granted' ? handleDisable : handleEnable}
          className={`notification-toggle-button ${
            permission === 'granted' ? 'notification-toggle-button--enabled' : ''
          }`}
        >
          {permission === 'granted' ? 'Disable' : 'Enable'}
        </button>
      </div>

      {error && (
        <div className="notification-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {showSuccess && (
        <div className="notification-success">
          <Check size={16} />
          <span>
            {permission === 'granted' 
              ? 'Notifications enabled successfully!' 
              : 'Notifications disabled successfully!'}
          </span>
        </div>
      )}

      <div className="notification-types">
        <p className="notification-description">
          You'll receive notifications for:
        </p>
        <ul className="notification-list">
          <li>New challenge invites</li>
          <li>Comments on your posts</li>
          <li>Daily workout reminders</li>
        </ul>
      </div>
    </div>
  );
}