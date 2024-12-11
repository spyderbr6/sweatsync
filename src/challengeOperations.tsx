// challengeOperations.ts

import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

// Create a new challenge
export async function createChallenge(params: {
  title: string;
  description?: string;
  startAt?: Date;
  endAt?: Date;
  reward?: string;
  challengeType?: string;
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


export async function listChallenges(): Promise<Schema["Challenge"]["type"][]> {
  try {
    const result = await client.models.Challenge.list({});
    return result.data; // Return the array of challenge objects
  } catch (error) {
    console.error("Error listing challenges", error);
    return [];
  }
}
// Optionally, if you need to fetch participants for a challenge (used in the UI example)
export async function getParticipantsForChallenge(challengeID: string): Promise<Schema["ChallengeParticipant"]["type"][]> {
  try {
    const result = await client.models.ChallengeParticipant.list({});
    return result.data.filter((p) => p.challengeID === challengeID);
  } catch (error) {
    console.error("Error fetching participants for challenge", error);
    return [];
  }
}