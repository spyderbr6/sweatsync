// amplify/functions/rotateCreator/handler.ts
import { type EventBridgeHandler } from "aws-lambda";
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../data/resource';
import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/rotateCreator';
//import outputs from "../amplify_outputs.json";


const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: EventBridgeHandler<"Scheduled Event", null, boolean> = async (event) => {
  try {
    // Get all active group challenges that have creator rotation enabled
    const challenges = await client.models.Challenge.list({
      filter: {
        and: [
          { challengeType: { eq: 'GROUP' } },
          { status: { eq: 'ACTIVE' } },
          { dailyChallenges: { eq: true } }, // Make sure daily challenges are enabled
          // Only get challenges where next rotation is due (before now)
          { nextRotationDate: { le: new Date().toISOString() } }
        ]
      }
    });

    const rotationResults = await Promise.allSettled(
      challenges.data.map(async (challenge) => {
        try {
          if (!challenge.id) return false;

          // Get active participants
          const participants = await client.models.ChallengeParticipant.list({
            filter: {
              challengeID: { eq: challenge.id },
              status: { eq: "ACTIVE" }
            }
          });

          if (!participants.data.length) {
            console.log(`No active participants for challenge ${challenge.id}`);
            return false;
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
            return false;
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

          console.log(`Successfully rotated creator for challenge ${challenge.id}`, {
            previousCreator: challenge.currentCreatorId,
            newCreator: nextCreator,
            nextRotation: nextRotationDate
          });

          return true;
        } catch (error) {
          console.error(`Error processing challenge ${challenge.id}:`, error);
          return false;
        }
      })
    );

    // Count successful rotations
    const successfulRotations = rotationResults.filter(
      result => result.status === 'fulfilled' && result.value
    ).length;

    console.log(`Completed creator rotation. ${successfulRotations} challenges updated.`);
    return true;

  } catch (error) {
    console.error('Error in creator rotation:', error);
    return false;
  }
};