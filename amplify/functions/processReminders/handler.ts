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

        // Get all pending reminders due now
        const reminderResults = await client.models.ReminderSchedule.list({
            filter: {
                and: [
                    { status: { eq: 'PENDING' } },
                    { nextScheduled: { le: nowISOString } }
                ]
            }
        });

        console.log('[Process] Found reminders:', {
            count: reminderResults.data.length,
            timestamp: nowISOString
        });

        const processedReminders = await Promise.all(
            reminderResults.data.map(async (reminder) => {
                if (!reminder.id || !reminder.userId || !reminder.challengeId || !reminder.type) {
                    console.error('[Process] Invalid reminder data:', reminder);
                    return null;
                }

                // Validate reminder should still be sent
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
                    // Send notification
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

                    // Calculate next schedule based on preferences
                    const nextSchedule = calculateNextSchedule(
                        reminder.timePreference,
                        reminder.secondPreference,
                        nowISOString,
                        reminder.timezone || 'UTC'
                    );

                    await client.models.ReminderSchedule.update({
                        id: reminder.id,
                        lastSent: nowISOString,
                        status: 'PENDING',  // Keep pending for next schedule
                        nextScheduled: nextSchedule,
                        updatedAt: nowISOString
                    });

                    return reminder;
                } catch (error) {
                    console.error('[Process] Error processing reminder:', {
                        error,
                        reminderId: reminder.id,
                        userId: reminder.userId
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
    timePreference: string | null | undefined,
    secondPreference: string | null | undefined,
    currentTime: string,
    timezone: string = 'UTC'
): string {
    const now = new Date(currentTime);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const times: Date[] = [];

    // Add primary time
    if (timePreference) {
        const [primaryHours, primaryMinutes] = timePreference.split(':').map(Number);
        if (!isNaN(primaryHours) && !isNaN(primaryMinutes)) {
            const primaryTime = new Date(today);
            primaryTime.setHours(primaryHours, primaryMinutes, 0, 0);
            times.push(primaryTime);
        }
    }

    // Add secondary time
    if (secondPreference) {
        const [secondaryHours, secondaryMinutes] = secondPreference.split(':').map(Number);
        const secondaryTime = new Date(today);
        secondaryTime.setHours(secondaryHours, secondaryMinutes, 0, 0);
        times.push(secondaryTime);
    }

    // Sort times chronologically
    times.sort((a, b) => a.getTime() - b.getTime());

    // Find next valid time
    let nextTime = times.find(time => time > now);

    // If no time found today, use first time tomorrow
    if (!nextTime && times.length > 0) {
        nextTime = new Date(times[0]);
        nextTime.setDate(nextTime.getDate() + 1);
    }

    // Fallback to tomorrow at 9 AM if no valid times found
    if (!nextTime) {
        nextTime = new Date(today);
        nextTime.setDate(nextTime.getDate() + 1);
        nextTime.setHours(9, 0, 0, 0);
    }

    return nextTime.toISOString();
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