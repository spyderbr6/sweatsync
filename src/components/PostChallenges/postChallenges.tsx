// src/components/PostChallenges/PostChallenges.tsx
import React, { useEffect, useState } from 'react';
import { generateClient } from "aws-amplify/data";
import { useNavigate } from 'react-router-dom';
import type { Schema } from "../../../amplify/data/resource";
import { getChallengeStyle, getChallengeIcon } from '../../styles/challengeStyles';
import './postChallenges.css';

const client = generateClient<Schema>();

export interface Challenge {
  id: string;
  title: string | null;
  type: string | null;
  status?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}

export interface PostChallengesProps {
  postId: string;
  className?: string;
  /** Optional callback for when a challenge is clicked */
  onChallengeClick?: (challengeId: string) => void;
  /** Optional custom loading component */
  loadingComponent?: React.ReactNode;
  /** Optional custom error component */
  errorComponent?: React.ReactNode;
}


export const PostChallenges: React.FC<PostChallengesProps> = ({
  postId,
  className = '',
  onChallengeClick,
  loadingComponent,
  errorComponent
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadChallenges = async () => {
      if (!postId) {
        setError('Post ID is required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get post challenges with validation status
        const postResult = await client.models.PostforWorkout.get({ id: postId });
        if (!postResult.data || !postResult.data.challengeIds) {
          setIsLoading(false);
          return;
        }

        const challengeIds = postResult.data.challengeIds;
        if (challengeIds.length === 0) {
          setIsLoading(false);
          return;
        }

        // Filter out any null or undefined IDs and get challenges
        const validChallengeIds = challengeIds.filter((id): id is string =>
          id !== null && id !== undefined);

        // Get challenge details for each post challenge
        const challengePromises = validChallengeIds.map(id =>
          client.models.Challenge.get({ id })
        );

        const challengeResults = await Promise.all(challengePromises);

        if (!isMounted) return;

        const validChallenges = challengeResults
          .filter((result): result is NonNullable<typeof result> & {
            data: NonNullable<(typeof result)['data']>
          } => Boolean(result?.data))
          .map(result => ({
            id: result.data.id,
            title: result.data.title || null,
            type: result.data.challengeType || null,
            status: result.data.status || null,
            startAt: result.data.startAt || null,
            endAt: result.data.endAt || null
          }));

        setChallenges(validChallenges);

      } catch (err) {
        if (!isMounted) return;
        console.error('Error loading challenges:', err);
        setError('Failed to load challenges');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadChallenges();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  const handleChallengeClick = (challengeId: string) => {
    if (onChallengeClick) {
      onChallengeClick(challengeId);
    } else {
      navigate(`/challenge/${challengeId}`);
    }
  };

  if (isLoading) {
    if (loadingComponent) {
      return <div className={`post-challenges ${className}`}>{loadingComponent}</div>;
    }

    return (
      <div className={`post-challenges ${className}`}>
        <div className="post-challenges__loading">
          <div className="loading-pulse">
            <div className="loading-bar loading-bar--wide"></div>
            <div className="loading-bar loading-bar--full"></div>
            <div className="loading-bar loading-bar--full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    if (errorComponent) {
      return <div className={`post-challenges ${className}`}>{errorComponent}</div>;
    }

    return (
      <div className={`post-challenges ${className}`}>
        <p className="post-challenges__error">{error}</p>
      </div>
    );
  }

  if (!challenges.length) {
    return null;
  }

  return (
    <div className={`post-challenges ${className}`}>
      <div className="post-challenges__list">
        {challenges.map(challenge => {
          const style = getChallengeStyle(challenge.type);
          const Icon = getChallengeIcon(challenge.type, {
            size: 16,
            style: { color: style.mainColor }
          });

          return (
            <button
              key={challenge.id}
              onClick={() => handleChallengeClick(challenge.id)}
              className="challenge-tag"
              style={{
                backgroundColor: style.bgColor,
                borderColor: style.borderColor,
                color: style.textColor
              }}
            >
              <span className="challenge-tag__content">
                <span className="challenge-tag__title">
                  {challenge.title ?? 'Unnamed Challenge'}
                </span>
                {challenge.type && (
                  <span className="challenge-tag__type">
                    <span className="challenge-tag__icon">
                      {Icon}
                    </span>
                    <span className="challenge-tag__type-text">
                      {style.name}
                    </span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PostChallenges;