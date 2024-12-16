// challengeTypes.ts
export interface ChallengeDetails {
    id: string;
    title: string;
    description: string | null;
    startAt: string | null;
    endAt: string | null;
    challengeType: string | null;
    totalWorkouts: number | null;
    userParticipation: {
      points: number;
      workoutsCompleted: number;
      status: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
    } | null;
    totalParticipants: number;
    daysRemaining: number | null;
  }
  
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