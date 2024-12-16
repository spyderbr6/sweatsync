// challengeOperations.ts

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

// Create a new challenge
export async function createChallenge(params: {
  title: string;
  description: string;
  startAt?: Date;
  endAt?: Date;
  reward?: string;
  challengeType: string;
  totalWorkouts?: number;
}): Promise<string> {
  try {
    await client.models.Challenge.create({
      title: params.title,
      description: params.description,
      startAt: params.startAt?.toISOString(),
      endAt: params.endAt?.toISOString(),
      reward: params.reward,
      challengeType: params.challengeType,
      totalWorkouts: params.totalWorkouts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return "Challenge created successfully";
  } catch (error) {
    console.error("Error creating challenge", error);
    return "Failed to create challenge";
  }
}

// Delete a challenge by ID
export async function deleteChallenge(challengeID: string): Promise<string> {
  try {
    await client.models.Challenge.delete({ id: challengeID });
    return "Challenge deleted successfully";
  } catch (error) {
    console.error("Error deleting challenge", error);
    return "Failed to delete challenge";
  }
}

// Add a user as a participant to a challenge
export async function addParticipantToChallenge(params: {
  challengeID: string;
  userID: string;
}): Promise<string> {
  try {
    await client.models.ChallengeParticipant.create({
      challengeID: params.challengeID,
      userID: params.userID,
      status: "ACTIVE",
      points: 0,
      workoutsCompleted: 0,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return "Participant added successfully";
  } catch (error) {
    console.error("Error adding participant to challenge", error);
    return "Failed to add participant";
  }
}

// Update a participant's data (e.g., status, points, workoutsCompleted)
export async function updateParticipant(params: {
  participantID: string;
  status?: "ACTIVE" | "COMPLETED" | "DROPPED";
  points?: number;
  workoutsCompleted?: number;
  completedAt?: Date;
}): Promise<string> {
  try {
    const participantResp = await client.models.ChallengeParticipant.get({ id: params.participantID });
    if (!participantResp.data) {
      return "Participant not found";
    }
    await client.models.ChallengeParticipant.update({
      id: params.participantID,
      status: params.status ?? participantResp.data.status,
      points: params.points ?? participantResp.data.points,
      workoutsCompleted: params.workoutsCompleted ?? participantResp.data.workoutsCompleted,
      completedAt: params.completedAt ? params.completedAt.toISOString() : participantResp.data.completedAt,
      updatedAt: new Date().toISOString(),
    });
    return "Participant updated successfully";
  } catch (error) {
    console.error("Error updating participant", error);
    return "Failed to update participant";
  }
}


export async function listChallenges(userId?: string): Promise<Schema["Challenge"]["type"][]> {
  try {
    if (!userId) {
      // List all challenges if no userId is provided
      const result = await client.models.Challenge.list({});
      return result.data;
    }

    // Fetch active participations for the given user
    const participations = await client.models.ChallengeParticipant.list({
      filter: {
        userID: { eq: userId },
        status: { eq: "ACTIVE" },
      },
    });

    const activeChallengeIds = participations.data.map((p) => p.challengeID);

    if (activeChallengeIds.length === 0) return [];

    // Fetch challenges and explicitly assert non-null return types
    const challenges = await Promise.all(
      activeChallengeIds.map(async (id) => {
        const result = await client.models.Challenge.get({ id });
        return result.data;
      })
    );

    // Filter out any `null` values and assert non-nullable type
    return challenges.filter((challenge): challenge is NonNullable<typeof challenge> => challenge !== null);
  } catch (error) {
    console.error("Error listing challenges:", error);
    return [];
  }
}

export async function getPendingChallenges(userId: string) {
  try {
    const client = generateClient<Schema>();
    
    // Get pending challenge participations
    const pendingParticipations = await client.models.ChallengeParticipant.list({
      filter: {
        userID: { eq: userId },
        status: { eq: 'PENDING' }
      }
    });

    // Get full challenge details for each pending participation
    const pendingChallenges = await Promise.all(
      pendingParticipations.data.map(async (participation) => {
        if (!participation.challengeID) return null;

        const challengeResult = await client.models.Challenge.get({
          id: participation.challengeID
        });

        if (!challengeResult.data) return null;

        // Get the creator's username
        const creatorResult = await client.models.User.get({
          id: challengeResult.data.createdBy || ''
        });

        return {
          ...challengeResult.data,
          participationId: participation.id,
          creatorName: creatorResult.data?.preferred_username || 'Unknown User'
        };
      })
    );

    return pendingChallenges.filter((challenge): challenge is NonNullable<typeof challenge> => 
      challenge !== null
    );
  } catch (error) {
    console.error('Error fetching pending challenges:', error);
    throw error;
  }
}

export async function respondToChallenge(
  participationId: string,
  status: 'ACTIVE' | 'DROPPED'
) {
  try {
    const client = generateClient<Schema>();
    
    await client.models.ChallengeParticipant.update({
      id: participationId,
      status,
      updatedAt: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error('Error responding to challenge:', error);
    throw error;
  }
}

export async function checkChallengeParticipation(challengeId: string, userId: string) {
  try {
    const client = generateClient<Schema>();
    const result = await client.models.ChallengeParticipant.list({
      filter: {
        challengeID: { eq: challengeId },
        userID: { eq: userId }
      }
    });
    
    return result.data[0] || null;
  } catch (error) {
    console.error('Error checking challenge participation:', error);
    throw error;
  }
}


// Get detailed challenge data including participation stats
export async function getChallengeDetails(challengeId: string, userId: string) {
  try {
    const client = generateClient<Schema>();
    
    // Get challenge basic info
    const challengeResult = await client.models.Challenge.get({ id: challengeId });
    if (!challengeResult.data) {
      throw new Error('Challenge not found');
    }

    // Get user's participation details
    const participationResult = await client.models.ChallengeParticipant.list({
      filter: {
        challengeID: { eq: challengeId },
        userID: { eq: userId }
      }
    });
    
    // Get total participants count
    const participantsResult = await client.models.ChallengeParticipant.list({
      filter: {
        challengeID: { eq: challengeId },
        status: { eq: 'ACTIVE' }
      }
    });

    // Get total workouts count from PostChallenge
    const workoutsResult = await client.models.PostChallenge.list({
      filter: {
        challengeId: { eq: challengeId },
        validated: { eq: true }
      }
    });

    return {
      ...challengeResult.data,
      userParticipation: participationResult.data[0] || null,
      totalParticipants: participantsResult.data.length,
      totalWorkouts: workoutsResult.data.length,
      daysRemaining: challengeResult.data.endAt 
        ? Math.ceil((new Date(challengeResult.data.endAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null
    };
  } catch (error) {
    console.error('Error fetching challenge details:', error);
    throw error;
  }
}

// Get leaderboard data
export async function getChallengeLeaderboard(challengeId: string) {
  try {
    const client = generateClient<Schema>();
    
    const participantsResult = await client.models.ChallengeParticipant.list({
      filter: {
        challengeID: { eq: challengeId },
        status: { eq: 'ACTIVE' }
      }
    });

    // Get user details for each participant
    const leaderboardData = await Promise.all(
      participantsResult.data.map(async (participant) => {
        const userResult = await client.models.User.get({ 
          id: participant.userID || '' 
        });

        return {
          id: participant.userID,
          name: userResult.data?.preferred_username || 'Unknown User',
          points: participant.points || 0,
          workouts: participant.workoutsCompleted || 0,
          profilePicture: userResult.data?.pictureUrl || null
        };
      })
    );

    // Sort by points in descending order
    return leaderboardData.sort((a, b) => b.points - a.points);
  } catch (error) {
    console.error('Error fetching challenge leaderboard:', error);
    throw error;
  }
}

// Get challenge activity feed
export async function getChallengeActivity(challengeId: string) {
  try {
    const client = generateClient<Schema>();
    
    // Get all posts for this challenge
    const postsResult = await client.models.PostChallenge.list({
      filter: {
        challengeId: { eq: challengeId },
        validated: { eq: true }
      }
    });

    // Get additional details for each post
    const activityFeed = await Promise.all(
      postsResult.data.map(async (post) => {
        const userResult = await client.models.User.get({ 
          id: post.userId || '' 
        });

        const postResult = await client.models.PostforWorkout.get({ 
          id: post.postId || '' 
        });

        return {
          id: post.postId,
          userId: post.userId,
          username: userResult.data?.preferred_username || 'Unknown User',
          content: postResult.data?.content || '',
          timestamp: post.timestamp || '',
          points: 50, // You might want to calculate this based on your rules
          likes: postResult.data?.thumbsUp || 0,
          comments: 0, // You'll need to implement comment counting
          profilePicture: userResult.data?.pictureUrl || null,
          workoutImage: postResult.data?.url || null
        };
      })
    );

    // Sort by timestamp in descending order
    return activityFeed.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error('Error fetching challenge activity:', error);
    throw error;
  }
}