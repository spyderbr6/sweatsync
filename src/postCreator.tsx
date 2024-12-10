import React, { useState, useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { uploadData } from 'aws-amplify/storage';
import { listChallenges } from './challengeOperations';
import { useUser } from './userContext';
import './PostCreator.css';

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
    'strength': '#EF4444',
    'cardio': '#3B82F6',
    'flexibility': '#10B981',
    'endurance': '#8B5CF6',
    'general': '#F59E0B'
  };

  // Fetch challenges and user data on component mount
  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const challenges = await listChallenges();
        setAvailableChallenges(challenges);
      } catch (error) {
        console.error("Error fetching challenges:", error);
      }
    };

    fetchChallenges();
  }, []);


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
      const uniqueFileName = `${Date.now()}-${file.name}`;
      const path = `picture-submissions/${uniqueFileName}`;
      await uploadData({ path, data: file });

      // Create the post
      await client.models.PostforWorkout.create({
        content,
        url: path,
        username: userAttributes?.preferred_username,
        userID: userId,
        thumbsUp: 0,
        smiley: 0,
        trophy: 0
      });

      // For each selected challenge, update the participant's workout count
      await Promise.all(selectedChallenges.map(async (challengeId) => {
        try {
          // Get participant record
          const participantResult = await client.models.ChallengeParticipant.list({
            filter: {
              challengeID: { eq: challengeId },
              userID: { eq: userId }
            }
          });

          if (participantResult.data[0]) {
            const participant = participantResult.data[0];
            // Update workout count
            await client.models.ChallengeParticipant.update({
              id: participant.id,
              workoutsCompleted: (participant.workoutsCompleted || 0) + 1,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`Error updating challenge ${challengeId}:`, error);
        }
      }));

      // Reset form
      setContent("");
      setFile(null);
      setPreviewUrl(null);
      setStep('initial');
      setSelectedChallenges([]);

      onSuccess();

    } catch (error) {
      console.error("Error creating post:", error);
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
                  className={`post-creator__challenge-tag ${
                    selectedChallenges.includes(challenge.id) 
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