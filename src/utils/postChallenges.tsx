// PostChallenges.tsx
import React, { useEffect, useState } from 'react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { useNavigate } from 'react-router-dom';
import './postChallenges.css';

const client = generateClient<Schema>();

interface Challenge {
  id: string;
  title: string | null;
  type: string | null;
}

interface PostChallengesProps {
  postId: string;
  className?: string;
}

export const PostChallenges: React.FC<PostChallengesProps> = ({ 
  postId,
  className = ''
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    const loadChallenges = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const postChallenges = await client.models.PostChallenge.list({
          filter: { 
            postId: { eq: postId },
            validated: { eq: true }
          }
        });

        if (!postChallenges.data.length) {
          setIsLoading(false);
          return;
        }

        const challengePromises = postChallenges.data
          .filter(pc => pc.challengeId)
          .map(pc => client.models.Challenge.get({ id: pc.challengeId! }));

        const challengeResults = await Promise.all(challengePromises);

        const validChallenges = challengeResults
          .filter((result): result is NonNullable<typeof result> & { data: NonNullable<(typeof result)['data']> } => 
            result !== null && result.data !== null
          )
          .map(result => ({
            id: result.data.id,
            title: result.data.title || null,
            type: result.data.challengeType || null
          }));

        setChallenges(validChallenges);

      } catch (err) {
        console.error('Error loading challenges:', err);
        setError('Failed to load challenges');
      } finally {
        setIsLoading(false);
      }
    };

    if (postId) {
      loadChallenges();
    }
  }, [postId]);

  const getChallengeTypeClass = (type: string | null): string => {
    switch (type?.toLowerCase()) {
      case 'group':
        return 'challenge-tag--group';
      case 'personal':
        return 'challenge-tag--personal';
      case 'friends':
        return 'challenge-tag--friends';
      default:
        return 'challenge-tag--default';
    }
  };

  if (isLoading) {
    return (
      <div className={`post-challenges ${className}`}>
        <div className="loading-pulse">
          <div className="loading-bar loading-bar--wide"></div>
          <div className="loading-bar loading-bar--full"></div>
          <div className="loading-bar loading-bar--full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`post-challenges ${className}`}>
        <p className="error-message">{error}</p>
      </div>
    );
  }

  if (!challenges.length) {
    return null;
  }

  return (
    <div className={`post-challenges ${className}`}>
      <div className="post-challenges__list">
        {challenges.map(challenge => (
          <div
            key={challenge.id}
            onClick={() => navigate(`/challenge/${challenge.id}`)}
            className={`challenge-tag ${getChallengeTypeClass(challenge.type)}`}
          >
            <span className="challenge-tag__title">
              {challenge.title ?? 'Unnamed Challenge'}
            </span>
            <span className="challenge-tag__type">
              {challenge.type ?? 'other'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PostChallenges;