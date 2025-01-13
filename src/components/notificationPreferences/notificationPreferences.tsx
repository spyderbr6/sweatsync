// src/components/notificationPreferences/notificationPreferences.tsx
import { useState } from 'react';
import { Bell, BellOff, Check, AlertCircle, PhoneIcon } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useUser } from '../../userContext';

export function NotificationPreferences() {
  const { userId, isLoading } = useUser();
  const { 
    permission, 
    requestPermission, 
    unsubscribe, 
    error, 
    isSupported 
  } = usePushNotifications(userId);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check if the device is iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.platform);

  const handleEnable = async () => {
    await requestPermission();
    if (permission === 'granted') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleDisable = async () => {
    await unsubscribe();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // Handle loading state
  if (isLoading) {
    return (
      <div className="profile-info-section">
        <h2 className="profile-section-title">Loading notifications...</h2>
      </div>
    );
  }

  // Handle missing user
  if (!userId) {
    return (
      <div className="profile-info-section">
        <h2 className="profile-section-title">Unable to load notification preferences</h2>
        <p>Please try refreshing the page.</p>
      </div>
    );
  }

  // Render iOS message
  if (isIOS) {
    return (
      <div className="profile-info-section">
        <h2 className="profile-section-title">Notification Preferences</h2>
        
        <div className="notification-preference-status">
          <div className="notification-info">
            <PhoneIcon className="notification-icon notification-icon--disabled" />
            <div className="notification-details">
              <span className="notification-label">Push Notifications</span>
              <span className="notification-status-text">Not available in browser</span>
            </div>
          </div>
        </div>

        <div className="notification-error">
          <AlertCircle size={16} />
          <span>To enable notifications:
            <br />• Add SweatSync to your home screen
            <br />• Tap the share button in Safari
            <br />• Select "Add to Home Screen"
            <br />• Open SweatSync from your home screen</span>
        </div>
      </div>
    );
  }

  // Render unsupported browser message
  if (!isSupported) {
    return (
      <div className="profile-info-section">
        <h2 className="profile-section-title">Notification Preferences</h2>
        
        <div className="notification-preference-status">
          <div className="notification-info">
            <BellOff className="notification-icon notification-icon--disabled" />
            <div className="notification-details">
              <span className="notification-label">Push Notifications</span>
              <span className="notification-status-text">Not supported</span>
            </div>
          </div>
        </div>

        <div className="notification-error">
          <AlertCircle size={16} />
          <span>Your browser doesn't support push notifications. Try using Chrome, Firefox, or Edge.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-info-section">
      <h2 className="profile-section-title">Notification Preferences</h2>
      
      <div className="notification-preference-status">
        <div className="notification-info">
          {permission === 'granted' ? (
            <Bell className="notification-icon notification-icon--enabled" />
          ) : (
            <BellOff className="notification-icon notification-icon--disabled" />
          )}
          <div className="notification-details">
            <span className="notification-label">Push Notifications</span>
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
    </div>
  );
}