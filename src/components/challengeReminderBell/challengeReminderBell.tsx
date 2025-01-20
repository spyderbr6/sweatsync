// src/components/ChallengeReminderBell/ChallengeReminderBell.tsx
import { useEffect, useState, useRef } from 'react';
import { Bell, BellOff, Clock, X } from 'lucide-react';
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource";
import { useUser } from '../../userContext';
import './ChallengeReminderBell.css';

const client = generateClient<Schema>();

interface ChallengeReminderBellProps {
  challengeId: string;
}

interface ReminderSettings {
  enabled: boolean;
  primaryTime: string;
  secondaryTime?: string;
  timezone: string;
}

export function ChallengeReminderBell({ challengeId }: ChallengeReminderBellProps) {
  const { userId } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: false,
    primaryTime: "09:00",
    timezone: "UTC"
  });
  const [globalPreferences, setGlobalPreferences] = useState<ReminderSettings | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) {
      console.log('No user ID available');
      return;
    }
    loadReminderSettings();
  }, [userId, challengeId]);

  // Load both global and challenge-specific settings
  const loadReminderSettings = async () => {
    if (!userId) {
      setError('No user ID available');
      return;
    }

    try {
      setIsLoading(true);
      
      // Get global preferences
      const userResult = await client.models.User.get({ id: userId });
      if (userResult.data?.reminderPreferences) {
        try {
          const prefs = JSON.parse(userResult.data.reminderPreferences as string);
          setGlobalPreferences({
            enabled: prefs.enabled ?? true,
            primaryTime: prefs.primaryTime || "09:00",
            secondaryTime: prefs.secondaryTime,
            timezone: prefs.timezone || "UTC"
          });
        } catch (e) {
          console.error('Error parsing reminder preferences:', e);
        }
      }

      // Get challenge-specific reminder schedule
      if (!userId || !challengeId) {
        setError('Missing required IDs');
        return;
      }

      const scheduleResult = await client.models.ReminderSchedule.list({
        filter: {
          and: [
            { userId: { eq: userId } },
            { challengeId: { eq: challengeId } }
          ]
        }
      });

      if (scheduleResult.data.length > 0) {
        const schedule = scheduleResult.data[0];
        setSettings({
          enabled: schedule.enabled ?? false,
          primaryTime: schedule.timePreference || "09:00",
          secondaryTime: schedule.secondPreference|| '',
          timezone: schedule.timezone || "UTC"
        });
      } else {
        // Use global preferences as defaults
        setSettings({
          enabled: false, // Default to disabled for new challenge reminders
          primaryTime: globalPreferences?.primaryTime || "09:00",
          secondaryTime: globalPreferences?.secondaryTime,
          timezone: globalPreferences?.timezone || "UTC"
        });
      }
    } catch (err) {
      console.error('Error loading reminder settings:', err);
      setError('Failed to load reminder settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleReminders = async () => {
    if (!userId || !challengeId) return;

    try {
      const newEnabled = !settings.enabled;
      
      const scheduleResult = await client.models.ReminderSchedule.list({
        filter: {
          and: [
            { userId: { eq: userId } },
            { challengeId: { eq: challengeId } }
          ]
        }
      });

      const now = new Date().toISOString();
      
      if (scheduleResult.data.length > 0) {
        // Update existing schedule
        await client.models.ReminderSchedule.update({
          id: scheduleResult.data[0].id,
          enabled: newEnabled,
          updatedAt: now
        });
      } else {
        // Create new schedule with current settings
        await client.models.ReminderSchedule.create({
          userId,
          challengeId,
          type: 'DAILY_POST',
          scheduledTime: now,
          repeatDaily: true,
          timePreference: settings.primaryTime,
          secondPreference: settings.secondaryTime,
          timezone: settings.timezone,
          enabled: newEnabled,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
          nextScheduled: now
        });
      }

      setSettings(prev => ({
        ...prev,
        enabled: newEnabled
      }));

    } catch (err) {
      console.error('Error toggling reminders:', err);
      setError('Failed to update reminder settings');
    }
  };

  const handleTimeChange = async (field: 'primaryTime' | 'secondaryTime', value: string) => {
    if (!userId) {
      setError('No user ID available');
      return;
    }

    if (!challengeId) {
      setError('No challenge ID available');
      return;
    }

    try {
      const scheduleResult = await client.models.ReminderSchedule.list({
        filter: {
          and: [
            { userId: { eq: userId } },
            { challengeId: { eq: challengeId } }
          ]
        }
      });

      const now = new Date().toISOString();
      const updates = {
        [field === 'primaryTime' ? 'timePreference' : 'secondPreference']: value,
        updatedAt: now
      };

      if (scheduleResult.data.length > 0) {
        await client.models.ReminderSchedule.update({
          id: scheduleResult.data[0].id,
          ...updates
        });
      } else {
        await client.models.ReminderSchedule.create({
          userId,
          challengeId,
          type: 'DAILY_POST',
          scheduledTime: now,
          repeatDaily: true,
          timePreference: field === 'primaryTime' ? value : settings.primaryTime,
          secondPreference: field === 'secondaryTime' ? value : settings.secondaryTime,
          timezone: settings.timezone,
          enabled: true,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
          nextScheduled: now
        });
      }

      setSettings(prev => ({
        ...prev,
        [field]: value
      }));

    } catch (err) {
      console.error('Error updating reminder time:', err);
      setError('Failed to update reminder time');
    }
  };

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  if (isLoading) {
    return <div className="challenge-reminder-bell--loading"><Clock className="animate-spin" /></div>;
  }

  return (
    <div className="challenge-reminder-bell">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className={`challenge-reminder-bell__button ${settings.enabled ? 'challenge-reminder-bell__button--enabled' : ''}`}
        aria-label={settings.enabled ? 'Reminders enabled' : 'Reminders disabled'}
      >
        {settings.enabled ? <Bell /> : <BellOff />}
      </button>

      {showSettings && (
        <div className="challenge-reminder-bell__settings" ref={settingsRef}>
          <div className="challenge-reminder-bell__settings-header">
            <h3>Reminder Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="challenge-reminder-bell__close-button"
              aria-label="Close settings"
            >
              <X />
            </button>
          </div>

          <div className="challenge-reminder-bell__toggle-container">
            <span>Enable Reminders</span>
            <button
              onClick={handleToggleReminders}
              className={`challenge-reminder-bell__toggle ${settings.enabled ? 'challenge-reminder-bell__toggle--enabled' : ''}`}
            >
              {settings.enabled ? 'On' : 'Off'}
            </button>
          </div>

          {settings.enabled && (
            <div className="challenge-reminder-bell__time-settings">
              <div className="challenge-reminder-bell__time-input">
                <label htmlFor="primaryTime">Primary Time</label>
                <input
                  type="time"
                  id="primaryTime"
                  value={settings.primaryTime}
                  onChange={(e) => handleTimeChange('primaryTime', e.target.value)}
                />
              </div>

              <div className="challenge-reminder-bell__time-input">
                <label htmlFor="secondaryTime">
                  Secondary Time (Optional)
                </label>
                <input
                  type="time"
                  id="secondaryTime"
                  value={settings.secondaryTime || ''}
                  onChange={(e) => handleTimeChange('secondaryTime', e.target.value)}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="challenge-reminder-bell__error">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}