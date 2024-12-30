// src/utils/challengeDailyPrompt.tsx
import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useUser } from '../userContext';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import './challengeDailyPrompt.css';

const client = generateClient<Schema>();

interface ChallengeDailyPromptProps {
  challengeId: string;
  challengePoints: number;
  onSuccess: () => void;
}

const ChallengeDailyPrompt: React.FC<ChallengeDailyPromptProps> = ({
  challengeId,
  challengePoints,
  onSuccess
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userId, userAttributes } = useUser();
  const creatorName = userAttributes?.preferred_username || 'Unknown';
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const challengeTitle = `${creatorName}'s Daily Challenge - ${today.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric' 
  })}`;

  const handleSubmit = async () => {
    if (!description.trim() || !userId) return;

    try {
      setIsSubmitting(true);

      // Create as a regular challenge with daily challenge properties
      const result = await client.models.Challenge.create({
        title: challengeTitle,
        description: description.trim(),
        challengeType: 'GROUP',
        parentChallengeId: challengeId,
        isDailyChallenge: true,
        startAt: today.toISOString(),
        endAt: tomorrow.toISOString(),
        basePointsPerWorkout: challengePoints,
        totalWorkouts: 1,  // One workout per user for daily challenge
        createdBy: userId,
        createdAt: today.toISOString(),
        updatedAt: today.toISOString(),
        status: 'ACTIVE'
      });

      // If challenge created successfully, add creator as first participant
      if (result.data?.id) {
        await client.models.ChallengeParticipant.create({
          challengeID: result.data.id,
          userID: userId,
          status: 'ACTIVE',
          points: 0,
          workoutsCompleted: 0,
          joinedAt: today.toISOString(),
          updatedAt: today.toISOString()
        });
      }

      onSuccess();
      setIsEditing(false);
      setDescription('');

    } catch (error) {
      console.error('Error creating daily challenge:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="challenge-daily-prompt challenge-daily-prompt--warning">
      <div className="challenge-daily-prompt__content">
        <div className="challenge-daily-prompt__icon">
          <Trophy className="h-6 w-6 text-yellow-500" />
        </div>
        
        <div className="challenge-daily-prompt__text">
          <h3 className="challenge-daily-prompt__title">You're Today's Challenge Creator!</h3>
          
          {!isEditing ? (
            <>
              <p className="challenge-daily-prompt__description">
                Create today's daily challenge for your group. Your challenge needs to be created before midnight.
              </p>
              <button 
                onClick={() => setIsEditing(true)}
                className="challenge-daily-prompt__button"
              >
                Create Daily Challenge
              </button>
            </>
          ) : (
            <div className="challenge-daily-prompt__form">
              <p className="challenge-daily-prompt__info">
                Challenge Title: <strong>{challengeTitle}</strong>
                : Points: <strong>{challengePoints}</strong>
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe today's challenge for the group..."
                className="challenge-daily-prompt__textarea"
                rows={3}
                disabled={isSubmitting}
              />
              <div className="challenge-daily-prompt__actions">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="challenge-daily-prompt__button challenge-daily-prompt__button--secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmit}
                  className="challenge-daily-prompt__button"
                  disabled={isSubmitting || !description.trim()}
                >
                  {isSubmitting ? 'Creating...' : 'Submit Challenge'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChallengeDailyPrompt;