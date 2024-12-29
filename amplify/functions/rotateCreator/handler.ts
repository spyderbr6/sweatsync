//amplify/backend/function/rotateCreator/handler.ts
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../data/resource';
import type { EventBridgeHandler } from "aws-lambda";

const client = generateClient<Schema>();

export const handler: EventBridgeHandler<"Scheduled Event", null, void> = async (event) => {
    console.log("event", JSON.stringify(event, null, 2))

    try {
      // Get all active group challenges
      const challenges = await client.models.Challenge.list({
        filter: {
          and: [
            { challengeType: { eq: 'GROUP' }},
            { status: { eq: 'ACTIVE' }},
            { dailyChallenges: { eq: true }}
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

            // Calculate next rotation date
            const nextRotationDate = new Date();
            nextRotationDate.setDate(nextRotationDate.getDate() + 
              (challenge.rotationIntervalDays || 1));

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
              newCreator: nextCreator
            };
          } catch (error) {
            console.error(`Error processing challenge ${challenge.id}:`, error);
            throw error;
          }
        })
      );

    } catch (error) {
      console.error('Error in creator rotation:', error);
      throw error;
    }
  }