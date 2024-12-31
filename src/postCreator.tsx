import React, { useState, useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { listChallenges } from './challengeOperations';
import { updateChallengePoints, validateChallengePost } from './challengeRules';
import { useUser } from './userContext';
import './postCreator.css';
import { uploadImageWithThumbnails } from './utils/imageUploadUtils';
import { useDataVersion } from './dataVersionContext'; // Add this import

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

interface ChallengeSelectability {
  id: string;
  canSelect: boolean;
  reason?: string;
}

const PostCreator: React.FC<PostCreatorProps> = ({ onSuccess, onError }) => {
  const { userId, userAttributes } = useUser();
  const { incrementVersion } = useDataVersion();
  const [step, setStep] = useState<'initial' | 'details'>('initial');
  const [content, setContent] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [challengeSelectability, setChallengeSelectability] = useState<Record<string, ChallengeSelectability>>({});
  const { pictureUrl } = useUser();


  // Define challenge colors mapping
  const challengeColors: { [key: string]: string } = {
    'GROUP': '#10B981',
    'PERSONAL': '#8B5CF6',
    'PUBLIC': '#EF4444',
    'FRIENDS': '#3B82F6',
    'general': '#F59E0B'
  };

  // Fetch challenges and user data on component mount
  useEffect(() => {
    const loadAndValidateChallenges = async () => {
      try {
        if (!userId) return;
    
        // Fetch both regular challenges and daily challenges
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
    
        // Get all active challenges
        const [activeChallenges] = await Promise.all([
          listChallenges(userId),
        ]);
    
        // Combine regular and daily challenges
        const allChallenges = [
          ...activeChallenges
        ];
    
        setAvailableChallenges(allChallenges);
    
        // Get group challenges
        const groupChallenges = activeChallenges.filter(c => c.challengeType === 'GROUP');
        const personalChallenges = activeChallenges.filter(c => c.challengeType === 'PERSONAL');
        const dailyTypeChallenges = activeChallenges.filter(c => c.challengeType === 'DAILY');
    
        // Initialize selectability map
        const selectabilityMap: Record<string, ChallengeSelectability> = {};
    
        // Handle personal challenges
        personalChallenges.forEach(challenge => {
          selectabilityMap[challenge.id] = {
            id: challenge.id,
            canSelect: challenge.createdBy === userId,
            reason: challenge.createdBy !== userId ? 
              "Only the creator can post to personal challenges" : undefined
          };
        });
    
        // Validate group challenges
        if (groupChallenges.length > 0) {
          await Promise.all(groupChallenges.map(async (challenge) => {
            try {
              const validationResult = await validateChallengePost({
                challengeId: challenge.id,
                userId,
                postId: 'pending',
                timestamp: new Date().toISOString()
              });
    
              selectabilityMap[challenge.id] = {
                id: challenge.id,
                canSelect: validationResult.isValid,
                reason: validationResult.isValid ? undefined : validationResult.message
              };
            } catch (error) {
              console.error(`Error validating challenge ${challenge.id}:`, error);
              selectabilityMap[challenge.id] = {
                id: challenge.id,
                canSelect: false,
                reason: "Error validating challenge"
              };
            }
          }));
        }
    
        // Validate daily challenges
        if (dailyTypeChallenges.length > 0) {
          await Promise.all(dailyTypeChallenges.map(async (challenge) => {
            try {
              const validationResult = await validateChallengePost({
                challengeId: challenge.id,
                userId,
                postId: 'pending',
                timestamp: new Date().toISOString(),
                isDailyChallenge: true
              });
    
              selectabilityMap[challenge.id] = {
                id: challenge.id,
                canSelect: validationResult.isValid,
                reason: validationResult.isValid ? undefined : validationResult.message
              };
            } catch (error) {
              console.error(`Error validating daily challenge ${challenge.id}:`, error);
              selectabilityMap[challenge.id] = {
                id: challenge.id,
                canSelect: false,
                reason: "Error validating daily challenge"
              };
            }
          }));
        }
    
        // Make sure public challenges are always selectable
        activeChallenges
          .filter(c => c.challengeType === 'PUBLIC')
          .forEach(challenge => {
            selectabilityMap[challenge.id] = {
              id: challenge.id,
              canSelect: true
            };
          });
    
        setChallengeSelectability(selectabilityMap);
      } catch (error) {
        console.error("Error loading and validating challenges:", error);
      }
    };

    loadAndValidateChallenges();
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

      // Validate each selected challenge before proceeding
      if (selectedChallenges.length > 0) {
        const validationPromises = selectedChallenges.map(challengeId =>
          validateChallengePost({
            challengeId,
            userId,
            postId: 'pending', // We don't have the postId yet
            timestamp: new Date().toISOString(),
            content,
            isDailyChallenge: false // Regular workout post
          })
        );

        const validationResults = await Promise.all(validationPromises);
        const invalidResults = validationResults.filter(result => !result.isValid);

        if (invalidResults.length > 0) {
          throw new Error(invalidResults.map(r => r.message).join(', '));
        }
      }

      // Upload image
      const { originalPath } = await uploadImageWithThumbnails(file, 'picture-submissions', 1200);

      const result = await client.models.PostforWorkout.create({
        content,
        url: originalPath,
        username: userAttributes?.preferred_username,
        userID: userId,
        thumbsUp: 0,
        smiley: selectedChallenges.length,
        trophy: 0
      });

      if (!result.data) {
        throw new Error("Failed to create post");
      }

      const newPost = result.data;

      // Process selected challenges
      const challengePromises = selectedChallenges.map(async (challengeId) => {
        try {
          // Create PostChallenge entry with the actual postId now
          await client.models.PostChallenge.create({
            postId: newPost.id,
            challengeId,
            userId,
            timestamp: new Date().toISOString(),
            validated: true,
            validationComment: ""
          });

          // Update points now that the post is validated
          await updateChallengePoints({
            challengeId,
            userId,
            postType: 'workout',
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          console.error(`Error processing challenge ${challengeId}:`, error);
          throw error;
        }
      });

      // Use Promise.allSettled to handle partial failures
      const challengeResults = await Promise.allSettled(challengePromises);
      const failures = challengeResults.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );

      if (failures.length > 0) {
        console.warn(`${failures.length} challenge updates failed:`, failures);
        onError?.(new Error(`Post created but ${failures.length} challenge updates failed`));
      }

      // Reset form and notify success
      setContent("");
      setFile(null);
      setPreviewUrl(null);
      setStep('initial');
      setSelectedChallenges([]);
      incrementVersion();
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
              src={pictureUrl ?? '/profileDefault.png'}
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
              {availableChallenges.map(challenge => {
                const selectability = challengeSelectability[challenge.id];
                const isDisabled = !selectability?.canSelect;

                return (
                  <div key={challenge.id} className="challenge-tag-container">
                    <button
                      onClick={() => toggleChallenge(challenge.id)}
                      className={`post-creator__challenge-tag 
                    ${selectedChallenges.includes(challenge.id) ? 'post-creator__challenge-tag--selected' : ''} 
                    ${isDisabled ? 'post-creator__challenge-tag--disabled' : ''}`}
                      disabled={isDisabled}
                      style={{
                        '--tag-color': challengeColors[challenge.challengeType || 'general']
                      } as React.CSSProperties}
                      title={selectability?.reason}
                    >
                      {challenge.title}
                    </button>
                    {isDisabled && selectability?.reason && (
                      <div className="challenge-tag-tooltip">
                        {selectability.reason}
                      </div>
                    )}
                  </div>
                );
              })}
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