// amplify/functions/processReminders/handler.ts

import { EventBridgeHandler } from 'aws-lambda';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../data/resource';
import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/processReminders';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

enum ReminderType {
    DAILY_POST = "DAILY_POST",
    GROUP_POST = "GROUP_POST",
    CREATOR_ROTATION = "CREATOR_ROTATION"
  }
  
type NotificationType = 'CHALLENGE_DAILY_REMINDER' | 'CHALLENGE_GROUP_REMINDER' | 'CHALLENGE_CREATOR_REMINDER';

export const handler: EventBridgeHandler<"Scheduled Event", null, boolean> = async () => {
    try {
        const now = new Date();
        const nowISOString = now.toISOString();

        const reminderResults = await client.models.ReminderSchedule.list({
            filter: {
                and: [
                    { status: { eq: 'PENDING' } },
                    { nextScheduled: { le: nowISOString } }
                ]
            }
        });

        const processedReminders = await Promise.all(
            reminderResults.data.map(async (reminder) => {
                if (!reminder.id || !reminder.userId || !reminder.challengeId || !reminder.type) {
                    console.error('[Process] Invalid reminder data:', reminder);
                    return null;
                }

                const shouldSend = await validateReminder(reminder);
                if (!shouldSend) {
                    console.log('[Process] Reminder validation failed:', {
                        reminderId: reminder.id,
                        type: reminder.type
                    });

                    await client.models.ReminderSchedule.update({
                        id: reminder.id,
                        status: 'CANCELLED',
                        updatedAt: nowISOString
                    });
                    return null;
                }

                try {
                    await client.queries.sendPushNotificationFunction({
                        type: getNotificationType(reminder.type as ReminderType),
                        userID: reminder.userId,
                        title: getNotificationTitle(reminder.type as ReminderType),
                        body: await generateNotificationBody(reminder),
                        data: JSON.stringify({
                            challengeId: reminder.challengeId,
                            type: reminder.type
                        })
                    });

                    console.log('[Process] Notification sent:', {
                        reminderId: reminder.id,
                        userId: reminder.userId,
                        type: reminder.type
                    });

                    const updates = {
                        id: reminder.id,
                        lastSent: nowISOString,
                        status: reminder.repeatDaily ? 'PENDING' : 'SENT',
                        updatedAt: nowISOString
                    } as const;

                    if (reminder.repeatDaily) {
                        const nextScheduled = calculateNextSchedule(
                            reminder.timePreference || '09:00',
                            reminder.secondPreference,
                            nowISOString,
                            reminder.timezone || 'UTC'
                        );

                        console.log('[Process] Updating schedule:', {
                            reminderId: reminder.id,
                            nextScheduled,
                            timezone: reminder.timezone || 'UTC'
                        });

                        await client.models.ReminderSchedule.update({
                            ...updates,
                            nextScheduled
                        });
                    } else {
                        await client.models.ReminderSchedule.update(updates);
                    }

                    return reminder;
                } catch (error) {
                    console.error('[Process] Error handling reminder:', {
                        error,
                        reminderId: reminder.id,
                        userId: reminder.userId,
                        type: reminder.type
                    });
                    return null;
                }
            })
        );

        const successCount = processedReminders.filter(Boolean).length;
        console.log('[Process] Reminder processing complete:', {
            total: reminderResults.data.length,
            successful: successCount
        });

        return true;
    } catch (error) {
        console.error('[Process] Error processing reminders:', error);
        return false;
    }
};

async function validateReminder(reminder: NonNullable<Schema['ReminderSchedule']['type']>): Promise<boolean> {
    if (!reminder.challengeId || !reminder.userId || !reminder.type) {
        console.log('[Validation] Failed basic validation:', {
            hasChallenge: !!reminder.challengeId,
            hasUser: !!reminder.userId,
            hasType: !!reminder.type
        });
        return false;
    }

    try {
        const [challenge, preferencesResult] = await Promise.all([
            client.models.Challenge.get({ id: reminder.challengeId }),
            client.models.ReminderSchedule.list({
                filter: {
                    and: [
                        { challengeId: { eq: reminder.challengeId } },
                        { userId: { eq: reminder.userId } }
                    ]
                }
            })
        ]);

        console.log('[Validation] Challenge and preferences:', {
            challengeId: reminder.challengeId,
            userId: reminder.userId,
            challengeFound: !!challenge.data,
            challengeStatus: challenge.data?.status,
            preferencesCount: preferencesResult.data.length,
        });

        if (!challenge.data || challenge.data.status !== 'ACTIVE') {
            console.log('[Validation] Challenge inactive or not found');
            return false;
        }

        const preference = preferencesResult.data[0];
        console.log('[Validation] Preference check:', {
            preferenceFound: !!preference,
            enabled: preference?.enabled,
            reminderTypes: preference?.type
        });

        if (!preference?.enabled) {
            console.log('[Validation] Preferences disabled');
            return false;
        }

        const reminderType = reminder.type as ReminderType;

        if (!Object.values(ReminderType).includes(reminderType)) {
            console.log('[Validation] Invalid reminder type:', {
              type: reminderType,
              validTypes: Object.values(ReminderType)
            });
            return false;
          }

        if (reminderType === 'GROUP_POST' && challenge.data.maxPostsPerDay != null) {
            const dailyPosts = await getPostsCount(reminder.challengeId, reminder.userId, 'day');
            console.log('[Validation] Group post check:', {
                maxPostsPerDay: challenge.data.maxPostsPerDay,
                currentDailyPosts: dailyPosts,
                withinLimit: dailyPosts < challenge.data.maxPostsPerDay
            });
            if (dailyPosts >= challenge.data.maxPostsPerDay) {
                return false;
            }
        }

        if (reminderType === 'DAILY_POST') {
            const dailyPosts = await getPostsCount(reminder.challengeId, reminder.userId, 'day');
            console.log('[Validation] Daily post check:', {
                dailyPosts,
                needsReminder: dailyPosts === 0
            });
            if (dailyPosts > 0) {
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('[Validation] Error validating reminder:', {
            error,
            reminderId: reminder.id,
            challengeId: reminder.challengeId,
            userId: reminder.userId
        });
        return false;
    }
}

function calculateNextSchedule(
    timePreference: string,
    secondPreference: string | null | undefined,
    currentTime: string,
    timezone: string = 'UTC' // Default to UTC if no timezone specified
): string {
    try {
        // Convert current time to user's timezone
        const userNow = new Date(currentTime).toLocaleString('en-US', { timeZone: timezone });
        const now = new Date(userNow);

        // Calculate next schedule for each time preference
        const schedules: Date[] = [];

        // Helper to convert user's preferred time to UTC
        const convertToUTC = (timeStr: string, baseDate: Date): Date => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
                // Create date in user's timezone
                const localDate = new Date(baseDate);
                localDate.setHours(hours, minutes, 0, 0);

                // Convert to UTC string then back to Date to get UTC time
                return new Date(
                    new Date(localDate).toLocaleString('en-US', {
                        timeZone: 'UTC',
                        timeZoneName: 'short'
                    })
                );
            }
            throw new Error('Invalid time format');
        };

        // Get tomorrow's date in user's timezone
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Handle primary time
        try {
            const primarySchedule = convertToUTC(timePreference, tomorrow);
            schedules.push(primarySchedule);
            console.log('[Schedule] Primary time converted:', {
                original: timePreference,
                timezone,
                utc: primarySchedule.toISOString()
            });
        } catch (error) {
            console.error('[Schedule] Error converting primary time:', error);
        }

        // Handle secondary time if it exists
        if (secondPreference) {
            try {
                const secondarySchedule = convertToUTC(secondPreference, tomorrow);
                schedules.push(secondarySchedule);
                console.log('[Schedule] Secondary time converted:', {
                    original: secondPreference,
                    timezone,
                    utc: secondarySchedule.toISOString()
                });
            } catch (error) {
                console.error('[Schedule] Error converting secondary time:', error);
            }
        }

        // Return the earliest next schedule
        if (schedules.length > 0) {
            const nextSchedule = schedules.sort((a, b) => a.getTime() - b.getTime())[0];
            console.log('[Schedule] Selected next schedule:', {
                timezone,
                userTime: nextSchedule.toLocaleString('en-US', { timeZone: timezone }),
                utc: nextSchedule.toISOString()
            });
            return nextSchedule.toISOString();
        }

        // Fallback to default 9 AM tomorrow if no valid times
        console.log('[Schedule] Using fallback time');
        const defaultSchedule = convertToUTC('09:00', tomorrow);
        return defaultSchedule.toISOString();

    } catch (error) {
        console.error('[Schedule] Error in calculateNextSchedule:', {
            error,
            timePreference,
            secondPreference,
            timezone,
            currentTime
        });
        // Ultimate fallback - 9 AM UTC tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        return tomorrow.toISOString();
    }
}

function getNotificationType(reminderType: ReminderType): NotificationType {
    const typeMap: Record<ReminderType, NotificationType> = {
        'DAILY_POST': 'CHALLENGE_DAILY_REMINDER',
        'GROUP_POST': 'CHALLENGE_GROUP_REMINDER',
        'CREATOR_ROTATION': 'CHALLENGE_CREATOR_REMINDER'
    };
    return typeMap[reminderType];
}

function getNotificationTitle(reminderType: ReminderType): string {
    const titleMap: Record<ReminderType, string> = {
        'DAILY_POST': "Time for Your Daily Challenge!",
        'GROUP_POST': "Don't Forget Your Group Challenge",
        'CREATOR_ROTATION': "Your Turn to Create a Challenge"
    };
    return titleMap[reminderType];
}

async function generateNotificationBody(
    reminder: NonNullable<Schema['ReminderSchedule']['type']>
): Promise<string> {
    if (!reminder.type || !reminder.challengeId) {
        return "Time to check in on your challenge!";
    }

    try {
        const challenge = await client.models.Challenge.get({ id: reminder.challengeId });
        const challengeTitle = challenge.data?.title || "your challenge";
        const reminderType = reminder.type as ReminderType;

        const bodyMap: Record<ReminderType, string> = {
            'DAILY_POST': `Don't forget to complete ${challengeTitle} today!`,
            'GROUP_POST': `Keep up the momentum in ${challengeTitle}!`,
            'CREATOR_ROTATION': `It's your turn to create today's challenge for ${challengeTitle}`
        };

        return bodyMap[reminderType];
    } catch (error) {
        console.error('Error generating notification body:', error);
        return "Time to check in on your challenge!";
    }
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