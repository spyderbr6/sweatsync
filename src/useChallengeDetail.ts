import { useState, useEffect } from 'react';
import { useUser } from './userContext';
import { useUrlCache } from './urlCacheContext';
import { 
  getChallengeDetails, 
  getChallengeLeaderboard, 
  getChallengeActivity 
} from './challengeOperations';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();


interface ChallengeDetailState {
  isLoading: boolean;
  error: Error | null;
  challengeDetails: any | null;
  leaderboard: any[];
  activity: any[];
  profileUrls: { [key: string]: string };
  workoutUrls: { [key: string]: string };
  todaysChallengeCreated: boolean; 
  isCurrentCreator: boolean;      
}

export function useChallengeDetail(challengeId: string) {
  const { userId } = useUser();
  const { getStorageUrl } = useUrlCache();
  const [state, setState] = useState<ChallengeDetailState>({
    isLoading: true,
    error: null,
    challengeDetails: null,
    leaderboard: [],
    activity: [],
    profileUrls: {},
    workoutUrls: {}, 
    todaysChallengeCreated: false,
    isCurrentCreator: false
  });

  useEffect(() => {
    async function loadChallengeData() {
      if (!userId || !challengeId) return;

      try {
        setState(prev => ({ ...prev, isLoading: true }));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Fetch all data in parallel
        const [details, leaderboard, activity,todaysChallenge] = await Promise.all([
          getChallengeDetails(challengeId, userId),
          getChallengeLeaderboard(challengeId),
          getChallengeActivity(challengeId), 
          client.models.Challenge.list({
            filter: {
              and: [
                { parentChallengeId: { eq: challengeId }},
                { isDailyChallenge: { eq: true }},
                { startAt: { ge: today.toISOString() }},
                { startAt: { lt: tomorrow.toISOString() }}
              ]
            }
          })
        ]);

        // Process profile pictures and workout images
        const profileUrls: { [key: string]: string } = {};
        const workoutUrls: { [key: string]: string } = {};

        // Process leaderboard profile pictures
        await Promise.all(
          leaderboard.map(async (user) => {
            if (user.profilePicture) {
              try {
                profileUrls[user.id] = await getStorageUrl(user.profilePicture);
              } catch (error) {
                profileUrls[user.id] = '/profileDefault.png';
              }
            } else {
              profileUrls[user.id] = '/profileDefault.png';
            }
          })
        );

        // Process activity feed images
        await Promise.all(
          activity.map(async (item) => {
            // Profile pictures
            if (item.userId && !profileUrls[item.userId]) {
              if (item.profilePicture) {
                try {
                  profileUrls[item.userId] = await getStorageUrl(item.profilePicture);
                } catch (error) {
                  profileUrls[item.userId] = '/profileDefault.png';
                }
              } else {
                profileUrls[item.userId] = '/profileDefault.png';
              }
            }

            // Workout images
            if (item.id && item.workoutImage) {
              try {
                workoutUrls[item.id] = await getStorageUrl(item.workoutImage);
              } catch (error) {
                workoutUrls[item.id] = '/picsoritdidnthappen.webp';
              }
            }
          })
        );

        setState({
          isLoading: false,
          error: null,
          challengeDetails: details,
          leaderboard,
          activity,
          profileUrls,
          workoutUrls,
          todaysChallengeCreated: todaysChallenge.data.length > 0,
          isCurrentCreator: details.currentCreatorId === userId
        });

      } catch (error) {
        console.error('Error loading challenge data:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error('Failed to load challenge data')
        }));
      }
    }

    loadChallengeData();
  }, [challengeId, userId, getStorageUrl]);

  // Optional: Add refresh function
  const refreshData = () => {
    setState(prev => ({ ...prev, isLoading: true }));
    // This will trigger the useEffect
  };

  return {
    ...state,
    refreshData
  };
}