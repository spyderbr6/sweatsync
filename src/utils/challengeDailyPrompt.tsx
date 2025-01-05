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
  parentTitle:string;//feed parent title as prop
  onSuccess: () => void;
}

const ChallengeDailyPrompt: React.FC<ChallengeDailyPromptProps> = ({
  challengeId,
  challengePoints,
  parentTitle,
  onSuccess
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userId} = useUser();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const challengeTitle = `${parentTitle}'s Daily - ${today.toLocaleDateString('en-US', {
    month: 'numeric',
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
        challengeType: 'DAILY',
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

      if (result.data?.id) {
        // Add all active participants from parent challenge

        // First get all active participants from parent challenge
        const participants = await client.models.ChallengeParticipant.list({
          filter: {
            challengeID: { eq: challengeId },
            status: { eq: 'ACTIVE' }
          }
        });

        await Promise.all(
          participants.data.map(participant =>
            client.models.ChallengeParticipant.create({
              challengeID: result.data!.id,
              userID: participant.userID!,
              status: 'ACTIVE',
              points: 0,
              workoutsCompleted: 0,
              joinedAt: today.toISOString(),
              updatedAt: today.toISOString()
            })
          )
        );

 // Add notification for all participants
 try {
  const notificationPromises = participants.data.map(async (participant) => {
    if (!participant.userID) return;


    // Then trigger push notification with correct payload
    await client.queries.sendPushNotificationFunction({
      type: 'CHALLENGE_DAILY_ADDED',
      userID: participant.userID,
      title: "New Daily Challenge Available!",
      body: `${parentTitle}: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
      data: JSON.stringify({
        challengeId: result.data!.id,
        challengeType: 'DAILY',
        parentChallengeId: challengeId,
        description: description.substring(0, 100), // Added for action handling
        creatorId: userId // Added to track who created the challenge
      })
    });
  });

  await Promise.all(notificationPromises);
} catch (notificationError) {
  console.error('Error sending notifications:', notificationError);
  // We don't throw here to avoid failing the whole challenge creation
}

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