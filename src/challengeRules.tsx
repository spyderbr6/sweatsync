// src/challengeRules.ts

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

// Define our challenge types
export enum ChallengeType {
    GROUP = 'group',
    PERSONAL = 'personal',
    PUBLIC = 'public',
    NONE = 'none',
    FRIENDS = 'friends'
}

// Base interface for all challenge rules
interface BaseChallengeRules {
    challengeId: string;
    type: ChallengeType;
    endDate: string;
    basePointsPerWorkout: number;
    isActive: boolean;
}

// Specific interface for group challenge rules
interface GroupChallengeRules {
    challengeRuleId: string;
    maxPostsPerDay: number;
    maxPostsPerWeek: number;
    dailyChallenges: boolean;
    rotationIntervalDays?: number;
    currentCreatorId?: string;
    nextRotationDate?: string;
    dailyChallengePoints?: number;
}

interface ValidationResult {
    isValid: boolean;
    message: string;
}

interface PostValidationContext {
    userId: string;
    challengeId: string;
    timestamp: string;
}

// Helper function to create challenge rules
export async function createChallengeRules(
    challengeId: string,
    type: ChallengeType,
    baseRules: Omit<BaseChallengeRules, 'challengeId' | 'type'>,
    specificRules?: GroupChallengeRules
): Promise<string> {
    try {
        console.log('Creating challenge rules with:', {
            challengeId,
            type,
            baseRules,
            specificRules
        });
        // First create base rules
        const baseRuleResponse = await client.models.ChallengeRules.create({
            challengeId,
            type,
            ...baseRules,
            endDate: new Date(baseRules.endDate).toISOString(), // Convert string to ISO datetime
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        if (!baseRuleResponse.data) {
            throw new Error('Failed to create base challenge rules');
        }

        // If this is a group challenge and we have specific rules, create those too
        if (type === ChallengeType.GROUP && specificRules) {
            await client.models.GroupChallengeRules.create({
                ...specificRules,
                challengeRuleId: baseRuleResponse.data.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        return baseRuleResponse.data.id;
    } catch (error) {
        console.error('Error creating challenge rules:', error);
        throw error;
    }
}

export async function canPostToChallenge(
    context: PostValidationContext
): Promise<ValidationResult> {
    try {
        // First, get the base challenge rules using a filter on challengeId
        const baseRulesResponse = await client.models.ChallengeRules.list({ 
            filter: {
                challengeId: { eq: context.challengeId }
            }
        });

        if (!baseRulesResponse.data || baseRulesResponse.data.length === 0) {
            return {
                isValid: false,
                message: "Challenge rules not found"
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
        if (new Date(baseRules.endDate) < new Date()) {
            return {
                isValid: false,
                message: "This challenge has ended"
            };
        }

        // If it's a group challenge, perform group-specific validations
        if (baseRules.type === ChallengeType.GROUP) {
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
        // Get group-specific rules using list() with filter
        const groupRulesResponse = await client.models.GroupChallengeRules.list({ 
            filter: {
                challengeRuleId: { eq: ruleId }
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
            context.challengeId,
            context.userId,
            'day'
        );

        if (todayPosts >= groupRules.maxPostsPerDay) {
            return {
                isValid: false,
                message: `You've reached the daily limit of ${groupRules.maxPostsPerDay} posts`
            };
        }

        // Check weekly post limit
        const weeklyPosts = await getPostsCount(
            context.challengeId,
            context.userId,
            'week'
        );

        if (weeklyPosts >= groupRules.maxPostsPerWeek) {
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
    try {
        const now = new Date();
        let startDate: Date;

        if (period === 'day') {
            startDate = new Date(now.setHours(0, 0, 0, 0));
        } else {
            // Get start of week (Sunday)
            const day = now.getDay();
            startDate = new Date(now.setDate(now.getDate() - day));
            startDate.setHours(0, 0, 0, 0);
        }

        // Query PostChallenge entries
        const postsResponse = await client.models.PostChallenge.list({
            filter: {
                challengeId: { eq: challengeId },
                userId: { eq: userId },
                timestamp: { ge: startDate.toISOString() }
            }
        });

        return postsResponse.data.length;
    } catch (error) {
        console.error('Error counting posts:', error);
        return 0;
    }
}

async function updateDailyChallengeCreator(groupChallengeId: string): Promise<string | null> {
    try {
        const rulesResponse = await client.models.GroupChallengeRules.list({
            filter: {
                challengeRuleId: { eq: groupChallengeId }
            }
        });

        if (!rulesResponse.data.length) return null;

        const rules = rulesResponse.data[0];

        // Get all active participants
        const participants = await client.models.ChallengeParticipant.list({
            filter: {
                challengeID: { eq: groupChallengeId },
                status: { eq: "ACTIVE" }
            }
        });

        if (!participants.data.length) return null;

        // Find next creator
        const currentIndex = participants.data.findIndex(p => p.userID === rules.currentCreatorId);
        const nextIndex = (currentIndex + 1) % participants.data.length;
        const nextCreator = participants.data[nextIndex].userID;

        // Update rules
        if (!rules.rotationIntervalDays || !rules.currentCreatorId) {
            return null;
        }
        
        const nextRotationDate = new Date(
            Date.now() + rules.rotationIntervalDays * 86400000
        ).toISOString();
        
        await client.models.GroupChallengeRules.update({
            id: rules.id,
            currentCreatorId: nextCreator,
            nextRotationDate
        });

        return nextCreator;
    } catch (error) {
        console.error('Error updating challenge creator:', error);
        return null;
    }
}

export async function checkAndRotateCreator(groupChallengeId: string): Promise<boolean> {
    try {
        const rulesResponse = await client.models.GroupChallengeRules.list({
            filter: {
                challengeRuleId: { eq: groupChallengeId }
            }
        });

        if (!rulesResponse.data.length) return false;

        const rules = rulesResponse.data[0];
        if (!rules.nextRotationDate || !rules.dailyChallenges) return false;

        const now = new Date();
        const nextRotation = new Date(rules.nextRotationDate);

        if (now >= nextRotation) {
            const nextCreator = await updateDailyChallengeCreator(groupChallengeId);
            return !!nextCreator;
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
        // Get participant record
        const participantResult = await client.models.ChallengeParticipant.list({
            filter: {
                challengeID: { eq: context.challengeId },
                userID: { eq: context.userId },
                status: { eq: "ACTIVE" }
            }
        });

        const participant = participantResult.data[0];
        if (!participant) {
            console.error('No active participant found');
            return false;
        }

        // Get challenge rules to determine points
        const rulesResult = await client.models.ChallengeRules.list({
            filter: {
                challengeId: { eq: context.challengeId }
            }
        });

        if (!rulesResult.data.length) {
            console.error('No rules found for challenge');
            return false;
        }

        const baseRules = rulesResult.data[0];
        let pointsToAdd = baseRules.basePointsPerWorkout;

        // If it's a daily challenge, get specific points
        if (context.postType === 'dailyChallenge') {
            const groupRulesResult = await client.models.GroupChallengeRules.list({
                filter: {
                    challengeRuleId: { eq: context.challengeId }
                }
            });

            if (groupRulesResult.data.length && groupRulesResult.data[0].dailyChallengePoints) {
                pointsToAdd = groupRulesResult.data[0].dailyChallengePoints;
            }
        }

        // Get the challenge to check totalWorkouts
        const challengeResult = await client.models.Challenge.get({ id: context.challengeId });
        if (!challengeResult.data) {
            throw new Error("Challenge not found");
        }

        const newWorkoutCount = (participant.workoutsCompleted || 0) + 1;
        const newPoints = (participant.points || 0) + pointsToAdd;
        const targetWorkouts = challengeResult.data.totalWorkouts || 30;

        // Update participant record
        await client.models.ChallengeParticipant.update({
            id: participant.id,
            workoutsCompleted: newWorkoutCount,
            points: newPoints,
            updatedAt: new Date().toISOString(),
            ...(newWorkoutCount >= targetWorkouts && {
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
        // Check if challenge is still active
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
        if (new Date(challenge.endAt || "") < new Date()) {
            return {
                isValid: false,
                message: "Challenge has ended"
            };
        }

        // Get the user's participation status
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

        // For group challenges, check daily and weekly limits
        if (challenge.challengeType === "group") {
            return await validateGroupChallengePost(context, challenge.id);
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