import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource";
import { useUser } from '../../userContext';
import './reminderPreferences.css';

const client = generateClient<Schema>();

interface ReminderPreference {
  primaryTime: string;
  secondaryTime?: string;
  enabled: boolean;
}

interface UserReminderPreferences {
    primaryTime: string;
    secondaryTime?: string;
    enabled: boolean;
    timezone?: string;
  }

export function ReminderPreferences() {
  const { userId } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ReminderPreference>({
    primaryTime: "09:00",
    enabled: true
  });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadPreferences();
  }, [userId]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const userResult = await client.models.User.get({ id: userId! });
      
      if (userResult.data?.reminderPreferences && typeof userResult.data.reminderPreferences === 'string') {
        try {
          const parsedPrefs = JSON.parse(userResult.data.reminderPreferences) as UserReminderPreferences;
          setPreferences({
            primaryTime: parsedPrefs.primaryTime || "09:00",
            secondaryTime: parsedPrefs.secondaryTime,
            enabled: parsedPrefs.enabled ?? true
          });
        } catch (parseError) {
          console.error('Error parsing reminder preferences:', parseError);
          // Fall back to defaults if parse fails
          setPreferences({
            primaryTime: "09:00",
            enabled: true
          });
        }
      }
    } catch (err) {
      console.error('Error loading reminder preferences:', err);
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = (field: 'primaryTime' | 'secondaryTime', value: string) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleToggle = async () => {
    const newEnabled = !preferences.enabled;
    try {
      await updatePreferences({
        ...preferences,
        enabled: newEnabled
      });
      setPreferences(prev => ({
        ...prev,
        enabled: newEnabled
      }));
      showSuccessMessage();
    } catch (err) {
      setError('Failed to update preferences');
    }
  };

  const handleSave = async () => {
    try {
      await updatePreferences(preferences);
      showSuccessMessage();
    } catch (err) {
      setError('Failed to save preferences');
    }
  };

  const updatePreferences = async (prefs: ReminderPreference) => {
    if (!userId) return;

    await client.models.User.update({
      id: userId,
      reminderPreferences: JSON.stringify(prefs),
      updatedAt: new Date().toISOString()
    });
  };

  const showSuccessMessage = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  if (loading) {
    return (
      <div className="profile-info-section">
        <h2 className="profile-section-title">Loading preferences...</h2>
      </div>
    );
  }

  return (
    <div className="profile-info-section">
      <h2 className="profile-section-title">Reminder Preferences</h2>
      
      <div className="notification-preference-status">
        <div className="notification-info">
          <Clock 
            className={`notification-icon ${
              preferences.enabled ? 'notification-icon--enabled' : 'notification-icon--disabled'
            }`} 
          />
          <div className="notification-details">
            <span className="notification-label">Daily Reminders</span>
            <span className="notification-status-text">
              {preferences.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        <button
          onClick={handleToggle}
          className={`notification-toggle-button ${
            preferences.enabled ? 'notification-toggle-button--enabled' : ''
          }`}
        >
          {preferences.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      {preferences.enabled && (
        <div className="time-preferences">
          <div className="time-preference-item">
            <label htmlFor="primaryTime">Primary Reminder Time</label>
            <input
              type="time"
              id="primaryTime"
              value={preferences.primaryTime}
              onChange={(e) => handleTimeChange('primaryTime', e.target.value)}
              className="time-input"
            />
          </div>

          <div className="time-preference-item">
            <label htmlFor="secondaryTime">Secondary Reminder Time (Optional)</label>
            <input
              type="time"
              id="secondaryTime"
              value={preferences.secondaryTime || ''}
              onChange={(e) => handleTimeChange('secondaryTime', e.target.value)}
              className="time-input"
            />
          </div>

          <button onClick={handleSave} className="save-button">
            Save Times
          </button>
        </div>
      )}

      {error && (
        <div className="notification-error">
          <span>{error}</span>
        </div>
      )}

      {showSuccess && (
        <div className="notification-success">
          <span>Preferences updated successfully!</span>
        </div>
      )}
    </div>
  );
}