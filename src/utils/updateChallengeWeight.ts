// src/utils/updateChallengeWeight.ts
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

/**
 * Updates a user's current weight for all weight-tracking challenges they're participating in
 * 
 * @param userId The user's ID
 * @param newWeight The user's new weight value
 * @returns A promise that resolves when the update is complete
 */
export async function updateUserWeightInChallenges(
  userId: string,
  newWeight: number
): Promise<void> {
  try {
    // Find all active challenges the user is participating in that track weight
    const participationResults = await client.models.ChallengeParticipant.list({
      filter: {
        userID: { eq: userId },
        status: { eq: 'ACTIVE' }
      }
    });

    if (!participationResults.data.length) {
      return; // No active challenge participations
    }

    // Get challenge IDs to check which ones track weight
    const challengeIds = participationResults.data
      .map(participation => participation.challengeID)
      .filter(id => id !== null && id !== undefined) as string[];

    if (!challengeIds.length) {
      return; // No valid challenge IDs
    }

    // Fetch the challenges to see which ones track weight
    const challenges = await Promise.all(
      challengeIds.map(id => client.models.Challenge.get({ id }))
    );

    // Filter for participations in challenges that track weight
    const weightTrackingParticipations = participationResults.data.filter(participation => {
      if (!participation.challengeID) return false;
      
      // Find the corresponding challenge
      const challenge = challenges.find(c => 
        c.data?.id === participation.challengeID
      );
      
      // Check if the challenge tracks weight
      return challenge?.data?.trackWeight === true;
    });

    if (!weightTrackingParticipations.length) {
      return; // No participations in weight-tracking challenges
    }

    // Update each participation with the new weight
    await Promise.all(
      weightTrackingParticipations.map(participation => {
        if (!participation.id) return Promise.resolve(); // Skip if no ID
        
        return client.models.ChallengeParticipant.update({
          id: participation.id,
          currentWeight: newWeight,
          updatedAt: new Date().toISOString()
        });
      })
    );

    console.log(`Updated weight to ${newWeight} for user ${userId} in ${weightTrackingParticipations.length} challenges`);
  } catch (error) {
    console.error('Error updating weight in challenges:', error);
    throw error;
  }
}

/**
 * Updates the workoutsCompleted count for a user in a specific challenge
 * 
 * @param userId The user's ID
 * @param challengeId The challenge ID
 * @returns A promise that resolves when the update is complete
 */
export async function incrementWorkoutCount(
  userId: string,
  challengeId: string
): Promise<void> {
  try {
    // Find the user's participation in this challenge
    const participationResults = await client.models.ChallengeParticipant.list({
      filter: {
        userID: { eq: userId },
        challengeID: { eq: challengeId },
        status: { eq: 'ACTIVE' }
      }
    });

    if (!participationResults.data.length || !participationResults.data[0].id) {
      return; // No active participation found
    }

    const participation = participationResults.data[0];
    const currentCount = participation.workoutsCompleted || 0;
    
    // Increment the workouts completed count
    await client.models.ChallengeParticipant.update({
      id: participation.id,
      workoutsCompleted: currentCount + 1,
      updatedAt: new Date().toISOString()
    });

    // Check if the user has completed all required workouts
    if (participation.workoutsRequired && 
        currentCount + 1 >= participation.workoutsRequired) {
      // Mark the challenge as completed for this user
      await client.models.ChallengeParticipant.update({
        id: participation.id,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    console.log(`Incremented workout count for user ${userId} in challenge ${challengeId}`);
  } catch (error) {
    console.error('Error incrementing workout count:', error);
    throw error;
  }
}