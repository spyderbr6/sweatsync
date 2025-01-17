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

type ReminderType = 'DAILY_POST' | 'GROUP_POST' | 'CREATOR_ROTATION';
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

                    const updates = {
                        id: reminder.id,
                        lastSent: nowISOString,
                        status: reminder.repeatDaily ? 'PENDING' : 'SENT',
                        updatedAt: nowISOString
                    } as const;

                    if (reminder.repeatDaily && reminder.timePreference) {
                        const nextScheduled = calculateNextSchedule(reminder.timePreference, nowISOString);
                        await client.models.ReminderSchedule.update({
                            ...updates,
                            nextScheduled
                        });
                    } else {
                        await client.models.ReminderSchedule.update(updates);
                    }

                    return reminder;
                } catch (error) {
                    console.error('Error processing reminder:', error);
                    return null;
                }
            })
        );

        const successCount = processedReminders.filter(Boolean).length;
        console.log(`Successfully processed ${successCount} of ${reminderResults.data.length} reminders`);
        
        return true;
    } catch (error) {
        console.error('Error processing reminders:', error);
        return false;
    }
};

async function validateReminder(reminder: NonNullable<Schema['ReminderSchedule']['type']>): Promise<boolean> {
    if (!reminder.challengeId || !reminder.userId || !reminder.type) {
        return false;
    }

    try {
        const [challenge, preferencesResult] = await Promise.all([
            client.models.Challenge.get({ id: reminder.challengeId }),
            client.models.ChallengeReminderPreferences.list({
                filter: {
                    and: [
                        { challengeId: { eq: reminder.challengeId } },
                        { userId: { eq: reminder.userId } }
                    ]
                }
            })
        ]);

        if (!challenge.data || challenge.data.status !== 'ACTIVE') {
            return false;
        }

        const preference = preferencesResult.data[0];
        if (!preference?.enabled) {
            return false;
        }

        const reminderType = reminder.type as ReminderType;
        const validTypes = preference.reminderTypes as ReminderType[] || ['DAILY_POST'];
        if (!validTypes.includes(reminderType)) {
            return false;
        }

        if (reminderType === 'GROUP_POST' && challenge.data.maxPostsPerDay != null) {
            const dailyPosts = await getPostsCount(reminder.challengeId, reminder.userId, 'day');
            if (dailyPosts >= challenge.data.maxPostsPerDay) {
                return false;
            }
        }

        if (reminderType === 'DAILY_POST') {
            const dailyPosts = await getPostsCount(reminder.challengeId, reminder.userId, 'day');
            if (dailyPosts > 0) {
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
            tomorrow.setHours(9, 0, 0, 0);
        } else {
            tomorrow.setHours(hours, minutes, 0, 0);
        }

        return tomorrow.toISOString();
    } catch (error) {
        console.error('Error calculating next schedule:', error);
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