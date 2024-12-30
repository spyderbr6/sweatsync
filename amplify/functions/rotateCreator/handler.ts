//amplify/backend/function/rotateCreator/handler.ts
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../data/resource';
import type { EventBridgeHandler } from "aws-lambda";

const client = generateClient<Schema>();

export const handler: EventBridgeHandler<"Scheduled Event", null, void> = async (event) => {
  try {
    // Get all active group challenges that have creator rotation enabled
    const challenges = await client.models.Challenge.list({
      filter: {
        and: [
          { challengeType: { eq: 'GROUP' }},
          { status: { eq: 'ACTIVE' }},
          { creatorRotation: { eq: true }},
          // Only get challenges where next rotation is due (before now)
          { nextRotationDate: { le: new Date().toISOString() }}
        ]
      }
    });

    const rotationResults = await Promise.allSettled(
      challenges.data.map(async (challenge) => {
        try {
          if (!challenge.id) return;

          // Get active participants
          const participants = await client.models.ChallengeParticipant.list({
            filter: {
              challengeID: { eq: challenge.id },
              status: { eq: "ACTIVE" }
            }
          });

          if (!participants.data.length) {
            console.log(`No active participants for challenge ${challenge.id}`);
            return;
          }

          // Find current creator's index
          const currentIndex = participants.data.findIndex(
            p => p.userID === challenge.currentCreatorId
          );

          // Get next creator (wrap around to beginning if at end)
          const nextIndex = (currentIndex + 1) % participants.data.length;
          const nextCreator = participants.data[nextIndex].userID;

          if (!nextCreator) {
            console.log(`Could not determine next creator for challenge ${challenge.id}`);
            return;
          }

          // Calculate next rotation date (midnight tomorrow)
          const nextRotationDate = new Date();
          nextRotationDate.setDate(nextRotationDate.getDate() + 1);
          nextRotationDate.setHours(0, 0, 0, 0);

          // Update challenge with new creator
          await client.models.Challenge.update({
            id: challenge.id,
            currentCreatorId: nextCreator,
            nextRotationDate: nextRotationDate.toISOString(),
            updatedAt: new Date().toISOString()
          });

          return {
            challengeId: challenge.id,
            previousCreator: challenge.currentCreatorId,
            newCreator: nextCreator,
            nextRotation: nextRotationDate
          };
        } catch (error) {
          console.error(`Error processing challenge ${challenge.id}:`, error);
          throw error;
        }
      })
    );

    // Clean up old daily challenges
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await client.models.Challenge.list({
      filter: {
        and: [
          { challengeType: { eq: 'DAILY' }},
          { endAt: { le: yesterday.toISOString() }}
        ]
      }
    }).then(async (oldChallenges) => {
      // Archive old daily challenges
      await Promise.all(
        oldChallenges.data.map(challenge => 
          client.models.Challenge.update({
            id: challenge.id,
            status: 'ARCHIVED',
            updatedAt: new Date().toISOString()
          })
        )
      );
    });

    } catch (error) {
      console.error('Error in creator rotation:', error);
      throw error;
    }
  }