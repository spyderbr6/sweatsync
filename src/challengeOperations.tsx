// challengeOperations.ts

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

// Create a new challenge
export async function createChallenge(params: {
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  reward?: string;
  challengeType: 'none';
  totalWorkouts?: number;
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'DRAFT' | 'CANCELLED'; 
}): Promise<string> {
  try {
    await client.models.Challenge.create({
      title: params.title,
      description: params.description,
      startAt: params.startAt.toISOString(),
      endAt: params.endAt.toISOString(),
      reward: params.reward,
      challengeType: params.challengeType,
      totalWorkouts: params.totalWorkouts,
      status: params.status || 'DRAFT', // Set default to 'DRAFT' if not provided
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
      const result = await client.models.Challenge.list({
        filter: {
          or: [
            { status: { eq: 'ACTIVE' } },
            { status: { eq: 'DRAFT' } }
          ]
        }
      });
      return result.data;
    }

    // Get active participations
    const participations = await client.models.ChallengeParticipant.list({
      filter: {
        userID: { eq: userId },
        status: { eq: "ACTIVE" },
      },
    });

    const activeChallengeIds = participations.data.map((p) => p.challengeID);

    if (activeChallengeIds.length === 0) return [];

    // Since we can't use 'in' operator, we'll need to get all challenges
    // and filter in memory
    const allChallenges = await Promise.all(
      activeChallengeIds.map(async (id) => {
        const result = await client.models.Challenge.get({ id });
        return result.data;
      })
    );

    // Filter null values and check status
    return allChallenges.filter(
      (challenge): challenge is NonNullable<typeof challenge> =>
        challenge !== null &&
        (challenge.status === 'ACTIVE' || challenge.status === 'DRAFT'),
    );

  } catch (error) {
    console.error("Error listing challenges:", error);
    return [];
  }
}

export async function getPendingChallenges(userId: string) {
  try {
    // Calculate the cutoff time for expired invitations (48 hours ago)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 48);
    
    // Get pending challenge participations
    const pendingParticipations = await client.models.ChallengeParticipant.list({
      filter: {
        and: [
          { userID: { eq: userId } },
          { status: { eq: 'PENDING' } },
          // Only get invitations newer than cutoff time
          { invitedAt: { ge: cutoffTime.toISOString() } }
        ]
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

        // Get the inviter's username
        const inviterResult = participation.invitedBy 
          ? await client.models.User.get({
              id: participation.invitedBy
            })
          : null;

        return {
          ...challengeResult.data,
          participationId: participation.id,
          inviterName: inviterResult?.data?.preferred_username || 'Unknown User',
          invitedAt: participation.invitedAt,
          // Calculate time remaining before expiration
          expiresIn: participation.invitedAt 
            ? Math.floor((new Date(participation.invitedAt).getTime() + (24 * 60 * 60 * 1000) - Date.now()) / (60 * 1000))
            : 0 // minutes remaining
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
        userID: { eq: userId },
        or: [
          { status: { eq: 'ACTIVE' } },
          { status: { eq: 'COMPLETED' } }
        ]
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

//Removes the challenge from the UI by changing the status to ARCHIVED
export async function archiveChallenge(challengeID: string): Promise<string> {
  try {
    const challengeResp = await client.models.Challenge.get({ id: challengeID });
    if (!challengeResp.data) {
      return "Challenge not found";
    }

    await client.models.Challenge.update({
      id: challengeID,
      status: "ARCHIVED",
      updatedAt: new Date().toISOString(),
    });

    return "Challenge archived successfully";
  } catch (error) {
    console.error("Error archiving challenge:", error);
    return "Failed to archive challenge";
  }
}

//Removes the requested participant from the provided challengID
export async function removeParticipantFromChallenge(challengeID: string, userID: string): Promise<string> {
  try {
    const participantResp = await client.models.ChallengeParticipant.list({
      filter: {
        challengeID: { eq: challengeID },
        userID: { eq: userID },
        status: { eq: "ACTIVE" }
      },
    });

    if (!participantResp.data.length) {
      return "Participation not found";
    }

    await client.models.ChallengeParticipant.update({
      id: participantResp.data[0].id,
      status: "DROPPED",
      updatedAt: new Date().toISOString(),
    });

    return "Removed from challenge successfully";
  } catch (error) {
    console.error("Error removing participant:", error);
    return "Failed to remove participant";
  }
}

// Add this to challengeOperations.tsx

export async function inviteFriendToChallenge(params: {
  challengeId: string;
  inviterId: string;    
  friendId: string;     
}): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // 1. Verify challenge exists and inviter is the owner
    const challengeResult = await client.models.Challenge.get({ 
      id: params.challengeId 
    });

    if (!challengeResult.data) {
      return {
        success: false,
        message: "Challenge not found"
      };
    }

    if (challengeResult.data.createdBy !== params.inviterId) {
      return {
        success: false,
        message: "Only the challenge creator can send invitations"
      };
    }

    // 2. Verify they are friends
    const friendshipResult = await client.models.Friend.list({
      filter: {
        and: [
          { user: { eq: params.inviterId } },
          { friendUser: { eq: params.friendId } }
        ]
      }
    });

    if (!friendshipResult.data.length) {
      return {
        success: false,
        message: "You can only invite friends to challenges"
      };
    }

    // 3. Check if already participating
    const existingParticipation = await client.models.ChallengeParticipant.list({
      filter: {
        and: [
          { challengeID: { eq: params.challengeId } },
          { userID: { eq: params.friendId } },
          { 
            or: [
              { status: { eq: 'ACTIVE' } },
              { status: { eq: 'PENDING' } }
            ]
          }
        ]
      }
    });

    if (existingParticipation.data.length > 0) {
      const status = existingParticipation.data[0].status;
      return {
        success: false,
        message: status === 'ACTIVE' 
          ? "User is already participating in this challenge"
          : "User already has a pending invitation"
      };
    }

    // 4. Create the invitation
    await client.models.ChallengeParticipant.create({
      challengeID: params.challengeId,
      userID: params.friendId,
      status: "PENDING",
      points: 0,
      workoutsCompleted: 0,
      invitedBy: params.inviterId,
      invitedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {
      success: true,
      message: "Invitation sent successfully"
    };

  } catch (error) {
    console.error('Error inviting friend to challenge:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send invitation"
    };
  }
}