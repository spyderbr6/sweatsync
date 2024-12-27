// src/challengeRules.ts

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import {ChallengeType} from "./challengeTypes"

const client = generateClient<Schema>();

interface ValidationResult {
    isValid: boolean;
    message: string;
}

interface PostValidationContext {
    userId: string;
    Id: string;
    timestamp: string;
}

export async function canPostToChallenge(
    context: PostValidationContext
): Promise<ValidationResult> {
    try {
        // First, get the base challenge rules using a filter on challengeId
        const baseRulesResponse = await client.models.Challenge.list({ 
            filter: {
                id: { eq: context.Id }
            }
        });

        if (!baseRulesResponse.data || baseRulesResponse.data.length === 0) {
            return {
                isValid: false,
                message: "Challenge not found"
            };
        }

        const baseRules = baseRulesResponse.data[0];

        // Check if challenge is still active
        if (!baseRules.isActive) {
            return {
                isValid: false,
                message: "This challenge is no longer active"
            };
        }

        // Check if challenge has ended
        if (new Date(baseRules.endAt) < new Date()) {
            return {
                isValid: false,
                message: "This challenge has ended"
            };
        }

        // If it's a group challenge, perform group-specific validations
        if (baseRules.challengeType === ChallengeType.GROUP) {
            return await validateGroupChallengePost(context, baseRules.id);
        }

        // For other challenge types, just return valid
        return {
            isValid: true,
            message: "Post allowed"
        };
    } catch (error) {
        console.error('Error validating post:', error);
        return {
            isValid: false,
            message: "An error occurred while validating the post"
        };
    }
}

async function validateGroupChallengePost(
    context: PostValidationContext,
    ruleId: string
): Promise<ValidationResult> {
    try {
        //TODO: i dont think i need any of this any more. this will always return results if it got this far. 
        // Get group-specific rules using list() with filter
        const groupRulesResponse = await client.models.Challenge.list({ 
            filter: {
                id: { eq: ruleId }
            }
        });

        if (!groupRulesResponse.data || groupRulesResponse.data.length === 0) {
            return {
                isValid: false,
                message: "Group challenge rules not found"
            };
        }

        const groupRules = groupRulesResponse.data[0];

        // Check daily post limit
        const todayPosts = await getPostsCount(
            context.Id,
            context.userId,
            'day'
        );

        if (groupRules.maxPostsPerDay !==null && todayPosts >= groupRules.maxPostsPerDay) {
            return {
                isValid: false,
                message: `You've reached the daily limit of ${groupRules.maxPostsPerDay} posts`
            };
        }

        // Check weekly post limit
        const weeklyPosts = await getPostsCount(
            context.Id,
            context.userId,
            'week'
        );

        if (groupRules.maxPostsPerWeek !==null && weeklyPosts >= groupRules.maxPostsPerWeek) {
            return {
                isValid: false,
                message: `You've reached the weekly limit of ${groupRules.maxPostsPerWeek} posts`
            };
        }

        return {
            isValid: true,
            message: "Post allowed"
        };
    } catch (error) {
        console.error('Error validating group challenge post:', error);
        return {
            isValid: false,
            message: "An error occurred while validating the post"
        };
    }
}

// Helper function to count posts within a time period
async function getPostsCount(
    challengeId: string,
    userId: string,
    period: 'day' | 'week'
): Promise<number> {
    const now = new Date();
    let startDate = new Date(now);
    
    if (period === 'day') {
        startDate.setHours(0, 0, 0, 0);
    } else {
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
    }

    const postsResponse = await client.models.PostChallenge.list({
        filter: {
            challengeId: { eq: challengeId },
            userId: { eq: userId },
            timestamp: { ge: startDate.toISOString() }
        }
    });

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
    postType: 'workout' | 'dailyChallenge';
    timestamp: string;
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


interface ValidatePostContext {
    challengeId: string;
    userId: string;
    postId: string; 
    timestamp: string;
    isDailyChallenge?: boolean;
    content?: string;
}

interface ValidationResult {
    isValid: boolean;
    message: string;
}

export async function validateChallengePost(context: ValidatePostContext): Promise<ValidationResult> {
    try {
        const challengeResult = await client.models.Challenge.get({ 
            id: context.challengeId 
        });

        if (!challengeResult.data) {
            return {
                isValid: false,
                message: "Challenge not found"
            };
        }

        const challenge = challengeResult.data;

        // Check end date
        if (challenge.endAt && new Date(challenge.endAt) < new Date()) {
            return {
                isValid: false,
                message: "Challenge has ended"
            };
        }

        // Get participation status
        const participantResult = await client.models.ChallengeParticipant.list({
            filter: {
                challengeID: { eq: context.challengeId },
                userID: { eq: context.userId }
            }
        });

        if (!participantResult.data.length) {
            return {
                isValid: false,
                message: "User is not a participant in this challenge"
            };
        }

        const participant = participantResult.data[0];
        if (participant.status !== "ACTIVE") {
            return {
                isValid: false,
                message: `Challenge participation status is ${participant.status}`
            };
        }

        // Group challenge specific validations
        if (challenge.challengeType === "GROUP") {
            const dailyPostCount = await getPostsCount(context.challengeId, context.userId, 'day');
            if (dailyPostCount >= (challenge.maxPostsPerDay || 1)) {
                return {
                    isValid: false,
                    message: "Daily post limit reached"
                };
            }

            const weeklyPostCount = await getPostsCount(context.challengeId, context.userId, 'week');
            if (weeklyPostCount >= (challenge.maxPostsPerWeek || 5)) {
                return {
                    isValid: false,
                    message: "Weekly post limit reached"
                };
            }
        }

        // Personal challenge validation
        if (challenge.challengeType === "PERSONAL" && challenge.createdBy !== context.userId) {
            return {
                isValid: false,
                message: "Only the creator can post to personal challenges"
            };
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