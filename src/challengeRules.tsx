// src/challengeRules.tsx

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import {calculateNextSchedule} from "./utils/calculateNextSchedule";

const client = generateClient<Schema>();

interface ValidationResult {
    isValid: boolean;
    message: string;
}

type BasicValidationSuccess = {
    isValid: true;
    message: string;
    challenge: NonNullable<Schema['Challenge']['type']>;
};

type BasicValidationFailure = {
    isValid: false;
    message: string;
};

type BasicValidationResult = BasicValidationSuccess | BasicValidationFailure;

// Helper function to count posts within a time period
async function getPostsCount(
    challengeId: string,
    userId: string,
    period: 'day' | 'week',
    postType?: 'workout' | 'meal' | 'weight'
): Promise<number> {
    const now = new Date();
    let startDate = new Date(now);

    // Set time period
    if (period === 'day') {
        startDate.setHours(0, 0, 0, 0);
    } else {
        startDate.setDate(now.getDate() - now.getDay()); // Start of week
        startDate.setHours(0, 0, 0, 0);
    }

    // Build filter
    const filter: any = {
        and: [
            { challengeId: { eq: challengeId } },
            { userId: { eq: userId } },
            { timestamp: { ge: startDate.toISOString() } },
            { validated: { eq: true } }
        ]
    };

    // Add post type filter if specified
    if (postType) {
        filter.and.push({ postType: { eq: postType } });
    }

    const postsResponse = await client.models.PostChallenge.list({ filter });
    return postsResponse.data.length;
}


export async function checkAndRotateCreator(challengeId: string): Promise<boolean> {
    try {
        const challenge = await client.models.Challenge.get({ id: challengeId });
        if (!challenge.data?.dailyChallenges) return false;

        const now = new Date();
        const nextRotation = new Date(challenge.data.nextRotationDate || '');

        if (now >= nextRotation && challenge.data.rotationIntervalDays) {
            const participants = await client.models.ChallengeParticipant.list({
                filter: {
                    challengeID: { eq: challengeId },
                    status: { eq: "ACTIVE" }
                }
            });

            if (!participants.data.length) return false;

            const currentIndex = participants.data.findIndex(
                p => p.userID === challenge.data?.currentCreatorId
            );
            const nextIndex = (currentIndex + 1) % participants.data.length;
            const nextCreator = participants.data[nextIndex].userID;
            const nextRotationDate = new Date(
                Date.now() + (challenge.data.rotationIntervalDays * 86400000)
            ).toISOString();

            await client.models.Challenge.update({
                id: challengeId,
                currentCreatorId: nextCreator,
                nextRotationDate,
                updatedAt: new Date().toISOString()
            });

            return true;
        }

        return false;
    } catch (error) {
        console.error('Error checking rotation:', error);
        return false;
    }
}


// Points calculation and update logic
interface PointsUpdateContext {
    challengeId: string;
    userId: string;
    postType: 'workout' | 'dailyChallenge' | 'dailyChallengeCreation';
    timestamp: string;
    streakCount?: number;  // For tracking consecutive days
    isGroupChallenge?: boolean;
    bonusPoints?: number;  // For special achievements
}

export async function updateChallengePoints(context: PointsUpdateContext): Promise<boolean> {
    try {
        const participantResult = await client.models.ChallengeParticipant.list({
            filter: {
                challengeID: { eq: context.challengeId },
                userID: { eq: context.userId }
            }
        });

        const participant = participantResult.data[0];
        if (!participant) return false;

        const challenge = await client.models.Challenge.get({
            id: context.challengeId
        });

        if (!challenge.data) return false;

        let pointsToAdd = challenge.data.basePointsPerWorkout || 10;

        if (context.postType === 'dailyChallenge' && challenge.data.dailyChallengePoints) {
            pointsToAdd = challenge.data.dailyChallengePoints;
        }

        const newWorkoutCount = (participant.workoutsCompleted || 0) + 1;
        const newPoints = (participant.points || 0) + pointsToAdd;

        await client.models.ChallengeParticipant.update({
            id: participant.id,
            workoutsCompleted: newWorkoutCount,
            points: newPoints,
            updatedAt: new Date().toISOString(),
            ...(newWorkoutCount >= (challenge.data.totalWorkouts || 30) && {
                status: "COMPLETED",
                completedAt: new Date().toISOString()
            })
        });

        return true;
    } catch (error) {
        console.error('Error updating challenge points:', error);
        return false;
    }
}


export interface ValidatePostContext {
    challengeId: string;
    userId: string;
    postId: string;
    timestamp: string;
    postType: 'workout' | 'meal' | 'weight';
    content?: string;
    measurementData?: {
        weight?: number;
        mealDetails?: {
            name: string;
            calories: number;
            time: string;
        };
    };
}

interface ValidationResult {
    isValid: boolean;
    message: string;
}

export async function validateChallengePost(context: ValidatePostContext): Promise<ValidationResult> {
    try {
        // 1. Basic Challenge Validation
        const basicValidation = await validateBasicRequirements(context);
        if (!basicValidation.isValid) {
            return basicValidation;
        }

        // 2. Challenge Type Rules
        // Now we know challenge exists because basicValidation.challenge is NonNullable
        const typeValidation = await validateChallengeTypeRules(
            basicValidation.challenge,
            context
        );
        if (!typeValidation.isValid) {
            return typeValidation;
        }

        // 3. Activity Tracking Rules (only if applicable)
        if (context.postType !== 'workout') {
            const trackingValidation = await validateTrackingRules(
                basicValidation.challenge,
                context
            );
            if (!trackingValidation.isValid) {
                return trackingValidation;
            }
        }

        return {
            isValid: true,
            message: "Post validated successfully"
        };

    } catch (error) {
        console.error('Error validating challenge post:', error);
        return {
            isValid: false,
            message: error instanceof Error ? error.message : "Validation failed"
        };
    }
}

async function validateBasicRequirements(context: ValidatePostContext): Promise<BasicValidationResult> {
    const challengeResult = await client.models.Challenge.get({ id: context.challengeId });

    if (!challengeResult.data) {
        return {
            isValid: false,
            message: "Challenge not found"
        };
    }

    const challenge = challengeResult.data;

    if (challenge.status !== 'ACTIVE') {
        return {
            isValid: false,
            message: "Challenge is not active"
        };
    }

    if (challenge.endAt && new Date(challenge.endAt) < new Date()) {
        return {
            isValid: false,
            message: "Challenge has ended"
        };
    }

    // Check participant status
    const participant = await client.models.ChallengeParticipant.list({
        filter: {
            challengeID: { eq: context.challengeId },
            userID: { eq: context.userId },
            status: { eq: "ACTIVE" }
        }
    });

    if (!participant.data.length) {
        return {
            isValid: false,
            message: "User is not an active participant"
        };
    }

    return {
        isValid: true,
        message: "Basic requirements met",
        challenge
    };
}

async function validateChallengeTypeRules(
    challenge: NonNullable<Schema['Challenge']['type']>,
    context: ValidatePostContext
): Promise<ValidationResult> {
    // Daily Challenge Rules
    if (challenge.isDailyChallenge) {
        const dailyPosts = await getPostsCount(context.challengeId, context.userId, 'day');
        if (dailyPosts > 0) {
            return {
                isValid: false,
                message: "Already posted today for this daily challenge"
            };
        }
    }

    // Group Challenge Rules
    if (challenge.challengeType === 'GROUP') {
        const [dailyPosts, weeklyPosts] = await Promise.all([
            getPostsCount(context.challengeId, context.userId, 'day'),
            getPostsCount(context.challengeId, context.userId, 'week')
        ]);

        if (dailyPosts >= (challenge.maxPostsPerDay || 1)) {
            return {
                isValid: false,
                message: "Daily post limit reached"
            };
        }

        if (weeklyPosts >= (challenge.maxPostsPerWeek || 5)) {
            return {
                isValid: false,
                message: "Weekly post limit reached"
            };
        }
    }

    // Personal Challenge Rules
    if (challenge.challengeType === 'PERSONAL' && challenge.createdBy !== context.userId) {
        return {
            isValid: false,
            message: "Only the creator can post to personal challenges"
        };
    }

    return {
        isValid: true,
        message: "Challenge type rules validated"
    };
}


export async function sendChallengePostNotifications(
    postId: string,
    challengeId: string,
    posterName: string,
    posterId: string,
    challengeTitle: string
) {
    const client = generateClient<Schema>();

    try {
        // Get all active participants
        const participantsResult = await client.models.ChallengeParticipant.list({
            filter: {
                challengeID: { eq: challengeId },
                status: { eq: 'ACTIVE' }
            }
        });

        if (!participantsResult.data?.length) return;

        // Prepare notification data
        const notificationData = {
            challengeId,
            postId,
        };

        // Send notification to each participant except the poster
        const notificationPromises = participantsResult.data
            .filter(participant => participant.userID !== posterId) // Exclude poster
            .map(participant =>
                client.queries.sendPushNotificationFunction({
                    type: 'CHALLENGE_POST',
                    userID: participant.userID,
                    title: `New Workout against ${challengeTitle}`,
                    body: `${posterName} just completed a workout in your challenge, don't let them pull ahead!`,
                    data: JSON.stringify(notificationData)
                })
            );

        await Promise.all(notificationPromises);

    } catch (error) {
        console.error('Error sending challenge post notifications:', error);
    }
}


export async function clearPendingReminders(
    userId: string,
    challengeId: string
): Promise<void> {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Find all pending reminders for this user/challenge/day
        const pendingReminders = await client.models.ReminderSchedule.list({
            filter: {
                and: [
                    { userId: { eq: userId } },
                    { challengeId: { eq: challengeId } },
                    { status: { eq: 'PENDING' } },
                    { nextScheduled: { ge: startOfDay.toISOString() } },
                    { nextScheduled: { le: endOfDay.toISOString() } }
                ]
            }
        });

        // Cancel each found reminder
        await Promise.all(pendingReminders.data.map(reminder => {
            if (!reminder.id) return;
            
            return client.models.ReminderSchedule.update({
                id: reminder.id,
                status: 'CANCELLED',
                updatedAt: new Date().toISOString()
            });
        }));

        // Calculate next schedule for repeating reminders
        const repeatingReminders = pendingReminders.data.filter(reminder => reminder.repeatDaily);
        
        await Promise.all(repeatingReminders.map(reminder => {
            if (!reminder.id) return;
            if (!reminder.timePreference) return;

            // Calculate next day's schedule
            const nextScheduled = calculateNextSchedule(
                reminder.timePreference,
                reminder.secondPreference,
                new Date().toISOString(),
                reminder.timezone || 'UTC'
            );

            return client.models.ReminderSchedule.update({
                id: reminder.id,
                status: 'PENDING',
                nextScheduled,
                updatedAt: new Date().toISOString()
            });
        }));

        console.log('[Reminders] Cleared pending reminders:', {
            userId,
            challengeId,
            cancelled: pendingReminders.data.length,
            rescheduled: repeatingReminders.length
        });

    } catch (error) {
        console.error('[Reminders] Error clearing pending reminders:', {
            error,
            userId,
            challengeId
        });
        // Don't throw error - this is a cleanup function and shouldn't break the main flow
    }
}

async function validateTrackingRules(
    challenge: NonNullable<Schema['Challenge']['type']>,
    context: ValidatePostContext
): Promise<ValidationResult> {
    switch (context.postType) {
        case 'weight':
            return validateWeightPost(challenge, context);
        case 'meal':
            return validateMealPost(challenge, context);
        default:
            return {
                isValid: true,
                message: "No tracking validation required"
            };
    }
}

async function validateWeightPost(
    challenge: NonNullable<Schema['Challenge']['type']>,
    context: ValidatePostContext
): Promise<ValidationResult> {
    // First check if challenge allows weight tracking
    if (!challenge.trackWeight) {
        return {
            isValid: false,
            message: "This challenge does not track weight"
        };
    }

    // Validate measurement data exists
    if (!context.measurementData?.weight) {
        return {
            isValid: false,
            message: "Weight measurement is required"
        };
    }

    // Check weekly weigh-in rules
    if (challenge.requireWeeklyWeighIn && challenge.weighInDay) {
        const postDate = new Date(context.timestamp);
        const dayOfWeek = postDate.toLocaleString('en-US', { weekday: 'long' }).toUpperCase();
        
        if (dayOfWeek !== challenge.weighInDay) {
            return {
                isValid: false,
                message: `Weight check-ins are only allowed on ${challenge.weighInDay.toLowerCase()}`
            };
        }

        // Check for existing weigh-in this week
        const weekStart = new Date(postDate);
        weekStart.setDate(postDate.getDate() - postDate.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const existingWeighIns = await getPostsCount(
            challenge.id,
            context.userId,
            'week',
            'weight'
        );

        if (existingWeighIns > 0) {
            return {
                isValid: false,
                message: "Already completed weigh-in for this week"
            };
        }
    } else if (challenge.requireWeeklyWeighIn) {
        // Handle case where weighInDay is not set but weekly weigh-in is required
        return {
            isValid: false,
            message: "Challenge configuration error: weigh-in day not set"
        };
    }

    return {
        isValid: true,
        message: "Weight post validated"
    };
}

async function validateMealPost(
    challenge: NonNullable<Schema['Challenge']['type']>,
    context: ValidatePostContext
): Promise<ValidationResult> {
    // Check if challenge allows meal tracking
    if (!challenge.trackMeals) {
        return {
            isValid: false,
            message: "This challenge does not track meals"
        };
    }

    // Validate meal details
    const mealDetails = context.measurementData?.mealDetails;
    if (!mealDetails) {
        return {
            isValid: false,
            message: "Meal details are required"
        };
    }

    if (!mealDetails.name?.trim() || !mealDetails.calories || !mealDetails.time) {
        return {
            isValid: false,
            message: "Meal post must include name, calories, and time"
        };
    }

    // Check daily meal post limit
    const dailyMealPosts = await getPostsCount(challenge.id, context.userId, 'day', 'meal');
    if (dailyMealPosts >= 5) { // Limit to 5 meals per day
        return {
            isValid: false,
            message: "Daily meal post limit reached"
        };
    }

    return {
        isValid: true,
        message: "Meal post validated"
    };
}