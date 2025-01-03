// amplify/functions/rotateCreator/handler.ts
import { type EventBridgeHandler } from "aws-lambda";
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../data/resource';
import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/rotateCreator';
//import outputs from "../amplify_outputs.json";

const SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: EventBridgeHandler<"Scheduled Event", null, boolean> = async (event) => {
    try {
        const now = new Date();
        const yesterday = new Date(now); // Clone 'now'
        yesterday.setDate(yesterday.getDate() - 1);

        // 1. Get all active challenges that need processing
        const activeChallenges = await client.models.Challenge.list({
            filter: {
                and: [
                    { status: { eq: 'ACTIVE' } },
                    {
                        or: [
                            // Expired challenges
                            { endAt: { le: now.toISOString() } },
                            // Challenges with inactive participants
                            { challengeType: { eq: 'DAILY' } }
                        ]
                    }
                ]
            }
        });

        await Promise.all(activeChallenges.data.map(async (challenge) => {
            if (!challenge.id) return;

            try {
                // Handle expired challenges
                if (challenge.endAt && new Date(challenge.endAt) <= now) {
                    await handleExpiredChallenge(challenge.id);
                    return;
                }

                // Handle participant cleanup for DAILY challenges
                if (challenge.challengeType === 'DAILY') {
                    await processParticipants(challenge, yesterday);
                }
            } catch (error) {
                console.error(`Error processing challenge ${challenge.id}:`, error);
            }
        }));

        // 2. Archive old daily challenges
        await archiveOldDailyChallenges(yesterday);

        return true;

    } catch (error) {
        console.error('Error in challenge cleanup:', error);
        throw error;
    }
};

async function handleExpiredChallenge(challengeId: string): Promise<void> {
    // Update challenge status
    await client.models.Challenge.update({
        id: challengeId,
        status: 'COMPLETED',
        updatedAt: new Date().toISOString(),
        updatedBy: SYSTEM_USER
    });

    // Get all active participants
    const participants = await client.models.ChallengeParticipant.list({
        filter: {
            challengeID: { eq: challengeId },
            status: { eq: 'ACTIVE' }
        }
    });

    // Update participant statuses
    await Promise.all(participants.data.map(participant => {
        if (!participant.id) return;

        return client.models.ChallengeParticipant.update({
            id: participant.id,
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: SYSTEM_USER
        });
    }));
}

async function processParticipants(challenge: Schema['Challenge']['type'], yesterday: Date): Promise<void> {
    if (!challenge.id) return;

    // Get active participants
    const participants = await client.models.ChallengeParticipant.list({
        filter: {
            challengeID: { eq: challenge.id },
            status: { eq: 'ACTIVE' }
        }
    });

    // Check each participant's activity
    await Promise.all(participants.data.map(async (participant) => {
        if (!participant.id || !participant.userID) return;

        // Get recent posts
        const recentPosts = await client.models.PostChallenge.list({
            filter: {
                and: [
                    { challengeId: { eq: challenge.id } },
                    { userId: { eq: participant.userID } },
                    { timestamp: { ge: yesterday.toISOString() } },
                    { validated: { eq: true } }
                ]
            }
        });

        // Check requirements
        const hasRecentPost = recentPosts.data.length > 0;
        const metWorkoutGoal = (participant.workoutsCompleted || 0) >= (challenge.totalWorkouts || 0);

        // Update inactive participants
        if (!hasRecentPost || !metWorkoutGoal) {
            await client.models.ChallengeParticipant.update({
                id: participant.id,
                status: 'DROPPED',
                dropReason: !hasRecentPost
                    ? 'No activity in last 24 hours'
                    : 'Failed to meet workout goal',
                updatedAt: new Date().toISOString(),
                updatedBy: SYSTEM_USER
            });
        }
    }));
}

async function archiveOldDailyChallenges(cutoffDate: Date): Promise<void> {
    // Get expired daily challenges
    const oldDailyChallenges = await client.models.Challenge.list({
        filter: {
            and: [
                { challengeType: { eq: 'DAILY' } },
                { endAt: { le: cutoffDate.toISOString() } },
                { status: { eq: 'ACTIVE' } }
            ]
        }
    });

    // Archive them
    await Promise.all(
        oldDailyChallenges.data.map(challenge => {
            if (!challenge.id) return;

            return client.models.Challenge.update({
                id: challenge.id,
                status: 'ARCHIVED',
                updatedAt: new Date().toISOString(),
                updatedBy: SYSTEM_USER
            });
        })
    );
}