// amplify/functions/processReminders/handler.ts

import { type Handler } from "aws-lambda";
import { EventBridgeEvent } from 'aws-lambda';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../data/resource';
import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/processReminders';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

interface ScheduledEvent {
    startTime: string;
    endTime: string;
  }
type ReminderType = 'DAILY_POST' | 'GROUP_POST' | 'CREATOR_ROTATION';
type NotificationType = 'CHALLENGE_DAILY_REMINDER' | 'CHALLENGE_GROUP_REMINDER' | 'CHALLENGE_CREATOR_REMINDER';


export const handler: Handler<EventBridgeEvent<'Scheduled Event', ScheduledEvent>> = async (event) => {
    try {
      const { startTime, endTime } = event.detail;
      if (!startTime || !endTime) {
        console.error('Missing required timing parameters');
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Missing required timing parameters' })
        };
      }
      const now = new Date();
      const nowISOString = now.toISOString();
  
      const reminderResults = await client.models.ReminderSchedule.list({
        filter: {
          and: [
            { status: { eq: 'PENDING' } },
            { nextScheduled: { 
              between: [startTime, endTime]
            }}
          ]
        }
      });
  
      const processedReminders = await Promise.all(
        reminderResults.data.map(async (reminder) => {
          // Validate required fields
          if (!reminder.id || !reminder.userId || !reminder.challengeId || !reminder.type) {
            console.error('Invalid reminder data:', reminder);
            return null;
          }
  
          const shouldSend = await validateReminder(reminder);
          
          if (!shouldSend) {
            await client.models.ReminderSchedule.update({
              id: reminder.id,
              status: 'CANCELLED',
              updatedAt: nowISOString
            });
            return null;
          }
  
          // Send the notification
          try {
            await client.queries.sendPushNotificationFunction({
              type: getNotificationType(reminder.type),
              userID: reminder.userId,
              title: getNotificationTitle(reminder.type),
              body: await generateNotificationBody(reminder),
              data: JSON.stringify({
                challengeId: reminder.challengeId,
                type: reminder.type
              })
            });
          } catch (error) {
            console.error('Error sending notification:', error);
            return null;
          }
  
          // Update reminder status
          const updates: {
            id: string;
            lastSent: string;
            status: 'PENDING' | 'SENT';
            updatedAt: string;
            nextScheduled?: string;
          } = {
            id: reminder.id,
            lastSent: nowISOString,
            status: reminder.repeatDaily ? 'PENDING' : 'SENT',
            updatedAt: nowISOString
          };
  
          if (reminder.repeatDaily && reminder.timePreference) {
            updates.nextScheduled = calculateNextSchedule(
              reminder.timePreference, 
              nowISOString
            );
          }
          try {
            await client.models.ReminderSchedule.update(updates);
            return reminder;
          } catch (error) {
            console.error('Error updating reminder:', error);
            return null;
          }
        })
      );
  
      const successfulReminders = processedReminders.filter(Boolean);
  
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Reminders processed successfully',
          processed: successfulReminders.length,
          total: reminderResults.data.length,
          timeWindow: { startTime, endTime }
        })
      };
  
    } catch (error) {
      console.error('Error processing reminders:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error processing reminders',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      };
    }
  };
  
  async function validateReminder(
    reminder: NonNullable<Schema['ReminderSchedule']['type']>
  ): Promise<boolean> {
    if (!reminder.challengeId || !reminder.userId || !reminder.type) {
      return false;
    }
  
    try {
      const challenge = await client.models.Challenge.get({ 
        id: reminder.challengeId 
      });
  
      if (!challenge.data || challenge.data.status !== 'ACTIVE') {
        return false;
      }
  
      // For group challenges, check posting limits
      if (reminder.type === 'GROUP_POST') {
        const dailyPosts = await getPostsCount(
          reminder.challengeId, 
          reminder.userId, 
          'day'
        );
        
        const maxPosts = challenge.data.maxPostsPerDay ?? 1;
        if (dailyPosts >= maxPosts) {
          return false;
        }
      }
  
      // For daily challenges, check if already posted today
      if (reminder.type === 'DAILY_POST') {
        const todayPosts = await getPostsCount(
          reminder.challengeId, 
          reminder.userId, 
          'day'
        );
        
        if (todayPosts > 0) {
          return false;
        }
      }
  
      return true;
    } catch (error) {
      console.error('Error validating reminder:', error);
      return false;
    }
  }
  
  function calculateNextSchedule(timePreference: string, currentTime: string): string {
    try {
      const now = new Date(currentTime);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const [hours, minutes] = timePreference.split(':').map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        // Default to 9 AM if time preference is invalid
        tomorrow.setHours(9, 0, 0, 0);
      } else {
        tomorrow.setHours(hours, minutes, 0, 0);
      }
      
      return tomorrow.toISOString();
    } catch (error) {
      console.error('Error calculating next schedule:', error);
      // Default to tomorrow at 9 AM if there's any error
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow.toISOString();
    }
  }

  
  function getNotificationType(reminderType: string): NotificationType {
    const typeMap: Record<ReminderType, NotificationType> = {
      'DAILY_POST': 'CHALLENGE_DAILY_REMINDER',
      'GROUP_POST': 'CHALLENGE_GROUP_REMINDER',
      'CREATOR_ROTATION': 'CHALLENGE_CREATOR_REMINDER'
    };
    return typeMap[reminderType as ReminderType] || 'CHALLENGE_DAILY_REMINDER';
  }
  
  async function generateNotificationBody(
    reminder: NonNullable<Schema['ReminderSchedule']['type']>
  ): Promise<string> {
    if (!reminder.type || !reminder.challengeId) {
      return "Time to check in on your challenge!";
    }
  
    try {
      const challenge = await client.models.Challenge.get({ 
        id: reminder.challengeId 
      });
      
      const challengeTitle = challenge.data?.title || "your challenge";
  
      const bodyMap: Record<ReminderType, string> = {
        'DAILY_POST': `Don't forget to complete ${challengeTitle} today!`,
        'GROUP_POST': `Keep up the momentum in ${challengeTitle}!`,
        'CREATOR_ROTATION': `It's your turn to create today's challenge for ${challengeTitle}`
      };
  
      return bodyMap[reminder.type as ReminderType] || "Time to check in on your challenge!";
    } catch (error) {
      console.error('Error generating notification body:', error);
      return "Time to check in on your challenge!";
    }
  }

  function getNotificationTitle(reminderType: string): string {
    const titleMap: Record<ReminderType, string> = {
      'DAILY_POST': "Time for Your Daily Challenge!",
      'GROUP_POST': "Don't Forget Your Group Challenge",
      'CREATOR_ROTATION': "Your Turn to Create a Challenge"
    };
    return titleMap[reminderType as ReminderType] || "Challenge Reminder";
  }
  

  async function getPostsCount(
    challengeId: string,
    userId: string,
    period: 'day' | 'week'
  ): Promise<number> {
    try {
      const now = new Date();
      const startDate = new Date(now);
      
      if (period === 'day') {
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
      }
  
      const postsResponse = await client.models.PostChallenge.list({
        filter: {
          and: [
            { challengeId: { eq: challengeId } },
            { userId: { eq: userId } },
            { timestamp: { ge: startDate.toISOString() } }
          ]
        }
      });
  
      return postsResponse.data.length;
    } catch (error) {
      console.error('Error getting posts count:', error);
      return 0;
    }
  }