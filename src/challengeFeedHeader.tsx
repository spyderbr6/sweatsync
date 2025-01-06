import { useEffect, useState } from 'react';
import { Trophy} from 'lucide-react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { useUser } from './userContext';
import { useNavigate } from 'react-router-dom';
//import { useDataVersion } from './dataVersionContext';
import { ChallengeType } from './challengeTypes';
import { getChallengeStyle, getChallengeIcon } from './styles/challengeStyles';


const client = generateClient<Schema>();

interface ChallengeWithStatus {
  id: string;
  title: string;
  challengeType: ChallengeType | null;
  hasPostedToday: boolean;
}

//I've removed caching for the moment. it uses dataversioncontext to tell the component to render or not and must be manually triggered by an action.
//type CacheData = {
 // version: number;
 // challenges: ChallengeWithProgress[];
//  timestamp: number;
//};
//const CACHE_KEY = 'activeChallengesCache';
//caching removed


const ChallengeFeedHeader = () => {
  const { userId } = useUser();
  //const { dataVersion } = useDataVersion(); // Use the context here
  const navigate = useNavigate();
  const [activeChallenges, setActiveChallenges] = useState<ChallengeWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChallenges = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // Get all active participations
        const participations = await client.models.ChallengeParticipant.list({
          filter: {
            userID: { eq: userId },
            status: { eq: 'ACTIVE' }
          }
        });

        // Get today's posts for these challenges
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaysPosts = await client.models.PostChallenge.list({
          filter: {
            userId: { eq: userId },
            and: [
              { timestamp: { ge: today.toISOString() } },
              { timestamp: { lt: tomorrow.toISOString() } }
            ],
            validated: { eq: true }
          }
        });

        // Create a Set of challenge IDs that have posts today
        const challengesWithPosts = new Set(
          todaysPosts.data.map(post => post.challengeId)
        );

        // Get challenge details and merge with post status
        const challengePromises = participations.data
          .filter(participation => participation.challengeID)
          .map(async (participation) => {
            try {
              const challengeResult = await client.models.Challenge.get({
                id: participation.challengeID!
              });

              if (challengeResult.data) {
                return {
                  id: challengeResult.data.id,
                  title: challengeResult.data.title,
                  challengeType: challengeResult.data.challengeType,
                  hasPostedToday: challengesWithPosts.has(challengeResult.data.id)
                };
              }
              return null;
            } catch (error) {
              console.error('Error fetching challenge:', error);
              return null;
            }
          });

        const challenges = (await Promise.all(challengePromises))
          .filter((challenge): challenge is ChallengeWithStatus => 
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
        const style = getChallengeStyle(
          challenge.challengeType, 
          challenge.hasPostedToday ? 'completed' : 'default'
        );
        
        const Icon = getChallengeIcon(challenge.challengeType, {
          className: "w-4 h-4",
          style: { color: style.mainColor }
        });

        return (
          <div 
            key={challenge.id}
            className={`challenge-alert`}
            onClick={() => navigate(`/challenge/${challenge.id}`)}
            style={{
              backgroundColor: style.bgColor,
              borderColor: style.borderColor,
              color: style.textColor,
              cursor: 'pointer',
              opacity: style.opacity,
            }}
          >
            {Icon}
            <span className="text-sm">
              {challenge.hasPostedToday && 
                <span className="ml-2">✓ </span>
              }
              {challenge.title}
            </span>
          </div>
        );
      })}
    </div>
  </div>
  );
};

export default ChallengeFeedHeader;