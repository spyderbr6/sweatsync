import { useEffect, useState } from 'react';
import { Trophy, Flame, Users } from 'lucide-react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { useUser } from './userContext';
import { useNavigate } from 'react-router-dom';

const client = generateClient<Schema>();

type ChallengeWithProgress = {
  id: string;
  title: string;
  description: string | null;
  challengeType: string | null;
  totalWorkouts: number;
  progress: number;
};

const ChallengeFeedHeader = () => {
  const { userId } = useUser();
  const navigate = useNavigate();
  const [activeChallenges, setActiveChallenges] = useState<ChallengeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChallenges = async () => {
      if (!userId) return;

      try {
        // 1. Fetch active challenge participations
        const participations = await client.models.ChallengeParticipant.list({
          filter: {
            userID: { eq: userId },
            status: { eq: 'ACTIVE' }
          }
        });

        // 2. Get all PostChallenge entries for this user
        const postChallenges = await client.models.PostChallenge.list({
          filter: {
            userId: { eq: userId }
          }
        });

        // 3. Count posts per challenge
        const postCountsByChallenge: Record<string, number> = {};
        postChallenges.data.forEach(post => {
          if (post.challengeId && post.validated !== false) {
            if (!postCountsByChallenge[post.challengeId]) {
              postCountsByChallenge[post.challengeId] = 0;
            }
            postCountsByChallenge[post.challengeId]++;
          }
        });

        // 4. Get challenge details and calculate progress
        const challengePromises = participations.data
          .filter(participation => participation.challengeID !== null)
          .map(async (participation) => {
            if (!participation.challengeID) return null;

            try {
              const challengeResult = await client.models.Challenge.get({
                id: participation.challengeID
              });

              if (challengeResult.data && challengeResult.data.title) {
                const challenge = challengeResult.data;
                // Get total posts for this challenge by this user
                const userPostCount = postCountsByChallenge[challenge.id] || 0;
                // Use totalWorkouts as the target goal
                const targetWorkouts = Math.max(challenge.totalWorkouts || 30, 1); // Fallback to 30 or minimum 1
                
                return {
                  id: challenge.id,
                  title: challenge.title,
                  description: challenge.description || null,
                  challengeType: challenge.challengeType || null,
                  totalWorkouts: targetWorkouts,
                  // Calculate percentage of completion
                  progress: Math.min(Math.round((userPostCount / targetWorkouts) * 100), 100)
                };
              }
            } catch (error) {
              console.error(`Error fetching challenge ${participation.challengeID}:`, error);
            }
            return null;
          });

        const challenges = (await Promise.all(challengePromises))
          .filter((challenge): challenge is ChallengeWithProgress => 
            challenge !== null
          );
        
        setActiveChallenges(challenges);
      } catch (error) {
        console.error('Error fetching challenges:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
  }, [userId]);

  // Rest of the component remains the same...
  if (loading) {
    return (
      <div className="feed__header">
        <div className="feed__challenges">
          <div className="challenge-alert challenge-alert--personal">
            Loading challenges...
          </div>
        </div>
      </div>
    );
  }

  if (activeChallenges.length === 0) {
    return (
      <div className="feed__header">
        <div className="feed__challenges">
          <div 
            className="challenge-alert challenge-alert--personal"
            onClick={() => navigate('/challenges')}
            style={{ cursor: 'pointer' }}
          >
            <Trophy className="w-4 h-4 text-green-500" />
            <span className="text-sm">Join your first challenge!</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="feed__header">
      <div className="feed__challenges">
        {activeChallenges.map((challenge) => {
          const getChallengeStyle = (type: string | null) => {
            switch (type?.toLowerCase()) {
              case 'personal':
                return {
                  className: 'challenge-alert--personal',
                  icon: <Flame className="w-4 h-4 text-orange-500" />
                };
              case 'group':
                return {
                  className: 'challenge-alert--group',
                  icon: <Users className="w-4 h-4 text-blue-500" />
                };
              default:
                return {
                  className: 'challenge-alert--weekly',
                  icon: <Trophy className="w-4 h-4 text-green-500" />
                };
            }
          };

          const style = getChallengeStyle(challenge.challengeType);

          return (
            <div 
              key={challenge.id}
              className={`challenge-alert ${style.className}`}
              onClick={() => navigate('/challenges')}
              style={{ cursor: 'pointer' }}
            >
              {style.icon}
              <span className="text-sm">
                {challenge.title} ({challenge.progress}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChallengeFeedHeader;