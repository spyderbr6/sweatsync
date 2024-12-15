import React, { useState, useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { listChallenges } from './challengeOperations';
import { useUser } from './userContext';
import './postCreator.css';
import { uploadImageWithThumbnails } from './utils/imageUploadUtils';



const client = generateClient<Schema>();

// Define proper types based on our schema
interface Challenge {
  id: string;
  title?: string | null;
  description?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  challengeType?: string | null;
}
interface PostCreatorProps {
  onSuccess: () => void;
  onError?: (error: Error) => void;
}

const PostCreator: React.FC<PostCreatorProps> = ({ onSuccess, onError }) => {
  const { userId, userAttributes } = useUser();
  const [step, setStep] = useState<'initial' | 'details'>('initial');
  const [content, setContent] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Define challenge colors mapping
  const challengeColors: { [key: string]: string } = {
    'group': '#10B981',
    'personal': '#8B5CF6',
    'public': '#EF4444',
    'friends': '#3B82F6',
    'general': '#F59E0B'
  };

  // Fetch challenges and user data on component mount
  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        if (!userId) return; // Ensure userId is available
  
        // Fetch only active challenges the user is participating in
        const activeChallenges = await listChallenges(userId);
        setAvailableChallenges(activeChallenges);
      } catch (error) {
        console.error("Error fetching active challenges:", error);
      }
    };
  
    fetchChallenges();
  }, [userId]);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      setStep('details');
    }
  };

  const handleRemoveImage = () => {
    setFile(null);
    setPreviewUrl(null);
    setStep('initial');
  };

  const toggleChallenge = (challengeId: string) => {
    setSelectedChallenges(prev =>
      prev.includes(challengeId)
        ? prev.filter(c => c !== challengeId)
        : [...prev, challengeId]
    );
  };

  const handlePost = async () => {
    if (!file || !userId) {
      onError?.(new Error("Missing required data for post"));
      return;
    }
  
    try {
      setLoading(true);
  
      // Upload image
      const { originalPath} = await uploadImageWithThumbnails(file, 'picture-submissions', 1200);

  
      //count challenges for storage
      const taggedChallengesCount = selectedChallenges.length;

      const result = await client.models.PostforWorkout.create({
        content,
        url: originalPath,
        username: userAttributes?.preferred_username,
        userID: userId,
        thumbsUp: 0,
        smiley: taggedChallengesCount,
        trophy: 0
      });
  
      if (!result.data) {
        throw new Error("Failed to create post");
      }
  
      const newPost = result.data;
  
      // Process selected challenges
      const challengePromises = selectedChallenges.map(async (challengeId) => {
        try {
          // Create PostChallenge entry to link post with challenge
          await client.models.PostChallenge.create({
            postId: newPost.id,
            challengeId,
            userId,
            timestamp: new Date().toISOString(),
            validated: true, // Default to true for now @future me, gpt should validate on publish
            validationComment: "" // Empty string for initial creation
          });
  
          // Find the participant record
          const participantResult = await client.models.ChallengeParticipant.list({
            filter: {
              challengeID: { eq: challengeId },
              userID: { eq: userId },
              status: { eq: "ACTIVE" }
            }
          });
  
          const participant = participantResult.data[0];
          if (participant) {
            // Get the challenge to check totalWorkouts
            const challengeResult = await client.models.Challenge.get({ id: challengeId });
            if (!challengeResult.data) {
              throw new Error("Challenge not found");
            }
  
            const newWorkoutCount = (participant.workoutsCompleted || 0) + 1;
            const newPoints = (participant.points || 0) + 10;
            const targetWorkouts = challengeResult.data.totalWorkouts || 30;
  
            await client.models.ChallengeParticipant.update({
              id: participant.id,
              workoutsCompleted: newWorkoutCount,
              points: newPoints,
              updatedAt: new Date().toISOString(),
              ...(newWorkoutCount >= targetWorkouts && {
                status: "COMPLETED",
                completedAt: new Date().toISOString()
              })
            });
          }
        } catch (error) {
          console.error(`Error processing challenge ${challengeId}:`, error);
          throw error;
        }
      });
  
      // Use Promise.allSettled to handle partial failures
      const challengeResults = await Promise.allSettled(challengePromises);
  
      // Check for any failures
      const failures = challengeResults.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
  
      if (failures.length > 0) {
        console.warn(`${failures.length} challenge updates failed:`, failures);
        onError?.(new Error(`Post created but ${failures.length} challenge updates failed`));
      }
  
      // Reset form
      setContent("");
      setFile(null);
      setPreviewUrl(null);
      setStep('initial');
      setSelectedChallenges([]);
  
      onSuccess();
    } catch (error) {
      console.error("Error creating post:", error);
      onError?.(error instanceof Error ? error : new Error("Failed to create post"));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'initial') {
    return (
      <div className="post-creator post-creator--initial">
        <div
          className="post-creator__upload-area"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera size={48} className="post-creator__upload-icon" />
          <p className="post-creator__upload-text">Share your workout photo</p>
          <span className="post-creator__upload-hint">Click to select a picture</span>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="post-creator__file-input"
        />
      </div>
    );
  }

  return (
    <div className="post-creator post-creator--details">
      <div className="post-creator__content">
        <div className="post-creator__media">
          {previewUrl && (
            <div className="post-creator__preview-container">
              <img
                src={previewUrl}
                alt="Preview"
                className="post-creator__preview-image"
              />
              <button
                onClick={handleRemoveImage}
                className="post-creator__remove-image"
                aria-label="Remove image"
              >
                <X size={20} />
              </button>
              <div className="post-creator__selected-tags">
                {selectedChallenges.map((challengeId, index) => {
                  const challenge = availableChallenges.find(c => c.id === challengeId);
                  if (!challenge?.title) return null;

                  const top = 20 + (Math.floor(index / 2) * 40);
                  const left = 20 + ((index % 2) * 50);
                  const color = challengeColors[challenge.challengeType || 'general'];

                  return (
                    <div
                      key={challengeId}
                      className="post-creator__selected-tag"
                      style={{
                        backgroundColor: `${color}dd`,
                        top: `${top}px`,
                        left: `${left}%`
                      }}
                      onClick={() => toggleChallenge(challengeId)}
                    >
                      {challenge.title}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="post-creator__form">
          <div className="post-creator__user-info">
            <img
              src="/profileDefault.png"
              alt="Profile"
              className="post-creator__avatar"
            />
            <span className="post-creator__username">{userAttributes?.preferred_username || 'Loading...'}</span>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share details about your workout..."
            className="post-creator__textarea"
            rows={4}
          />

          <div className="post-creator__available-challenges">
            <h3 className="post-creator__section-title">Add to Active Challenges</h3>
            <div className="post-creator__challenge-tags">
              {availableChallenges.map(challenge => (
                <button
                  key={challenge.id}
                  onClick={() => toggleChallenge(challenge.id)}
                  className={`post-creator__challenge-tag ${selectedChallenges.includes(challenge.id)
                    ? 'post-creator__challenge-tag--selected'
                    : ''
                    }`}
                  style={{
                    '--tag-color': challengeColors[challenge.challengeType || 'general']
                  } as React.CSSProperties}
                >
                  {challenge.title}
                </button>
              ))}
            </div>
          </div>

          <div className="post-creator__actions">
            <button
              onClick={handlePost}
              disabled={loading}
              className="post-creator__post-button"
            >
              {loading ? "Posting..." : "Share Workout"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostCreator;