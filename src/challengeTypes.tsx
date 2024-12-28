// src/challengeTypes.tsx

// Define the base enum for challenge types
export enum ChallengeType {
  NONE = 'none',
  PUBLIC = 'PUBLIC',
  GROUP = 'GROUP',
  PERSONAL = 'PERSONAL',
  FRIENDS = 'FRIENDS',
  DAILY = 'DAILY'
}

// Define challenge status
export enum ChallengeStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
  DRAFT = 'DRAFT',
  CANCELLED = 'CANCELLED'
}

// Your existing interfaces with updated types
export interface ChallengeDetails {
  id: string;
  title: string;
  description: string | null;
  startAt: string | null;
  endAt: string | null;
  challengeType: ChallengeType | null;  // Updated to use enum
  totalWorkouts: number | null;
  userParticipation: {
      points: number;
      workoutsCompleted: number;
      status: ChallengeStatus;  // Updated to use enum
  } | null;
  totalParticipants: number;
  daysRemaining: number | null;
}

// Your other existing interfaces...
export interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  workouts: number;
  profilePicture: string | null;
}

export interface ActivityEntry {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
  points: number;
  likes: number;
  comments: number;
  profilePicture: string | null;
  workoutImage: string | null;
  achievement?: string;
}

// Add validation type for challenge posts
export interface ChallengePostValidation {
  isValid: boolean;
  message: string;
}

// Add challenge participation type
export interface ChallengeParticipation {
  challengeID: string;
  userID: string;
  status: 'ACTIVE' | 'COMPLETED' | 'DROPPED' | 'PENDING';
  points?: number;
  workoutsCompleted?: number;
  joinedAt?: string;
  completedAt?: string;
  updatedAt?: string;
}