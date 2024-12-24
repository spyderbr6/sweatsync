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
        // First create base rules
        const baseRuleResponse = await client.models.ChallengeRules.create({
            challengeId,
            type,
            ...baseRules,
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