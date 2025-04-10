// src/postCreator.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../amplify/data/resource";
import { PostData, WorkoutPostData, MealPostData, WeightPostData } from './types/posts';
import { useUser } from './userContext';
import { useDataVersion } from './dataVersionContext';
import { uploadImageWithThumbnails } from './utils/imageUploadUtils';
import { WorkoutForm } from './components/PostForms/WorkoutForm';
import { MealForm } from './components/PostForms/MealForm';
import { WeightForm } from './components/PostForms/WeightForm';
import { listChallenges } from './challengeOperations';
import { validateChallengePost, ValidatePostContext } from './challengeRules';
import { getChallengeStyle } from './styles/challengeStyles';
import { analyzeImage } from './utils/imageAnalysis';

const client = generateClient<Schema>();

interface PostCreatorProps {
  onSuccess: () => void;
  onError?: (error: Error) => void;
}

interface Challenge {
  id: string;
  title?: string | null;
  challengeType?: string | null;
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
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');


  // Initialize with a complete workout post data
  const [postData, setPostData] = useState<PostData>({
    type: 'workout',
    content: '',
    url: '',
    challengeIds: [],
    smiley: 0
  });

  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>([]);
  const [challengeSelectability, setChallengeSelectability] = useState<Record<string, ChallengeSelectability>>({});

  useEffect(() => {
    const loadAndValidateChallenges = async () => {
      if (!userId) return;

      try {
        const activeChallenges = await listChallenges(userId);
        setAvailableChallenges(activeChallenges);

        const selectabilityMap: Record<string, ChallengeSelectability> = {};

        await Promise.all(activeChallenges.map(async (challenge) => {
          try {
            const validationContext: ValidatePostContext = {
              challengeId: challenge.id,
              userId,
              postId: 'pending',
              timestamp: new Date().toISOString(),
              postType: postData.type,
              content: postData.content,
              measurementData: getMeasurementData()
            };

            const validationResult = await validateChallengePost(validationContext);

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

        setChallengeSelectability(selectabilityMap);
      } catch (error) {
        console.error("Error loading challenges:", error);
      }
    };

    loadAndValidateChallenges();
  }, [
    userId,
    postData.type,
    postData.content,
    // Include relevant measurement data based on type
    ...(postData.type === 'weight' ? [(postData as WeightPostData).weight?.value] : []),
    ...(postData.type === 'meal' ? [JSON.stringify((postData as MealPostData).meal)] : [])
  ]);

  // Helper function to get measurement data based on post type
  const getMeasurementData = () => {
    switch (postData.type) {
      case 'workout':
        return {};
      case 'weight':
        return postData.weight?.value
          ? { weight: postData.weight.value }
          : undefined;

      case 'meal': {
        const meal = (postData as MealPostData).meal;
        if (meal?.name && meal?.calories && meal?.time) {
          return {
            mealDetails: {
              name: meal.name,
              calories: meal.calories,
              time: meal.time
            }
          };
        }
        return undefined;
      }

      default:
        return undefined;
    }
  };

  // Type-safe update handlers
  const handleWorkoutUpdate = (updates: Partial<WorkoutPostData>) => {
    setPostData(prev => ({
      ...prev,
      ...updates,
      type: 'workout',
      smiley: (updates.challengeIds || prev.challengeIds).length
    }));
  };

  const handleMealUpdate = (updates: Partial<MealPostData>) => {
    setPostData(prev => {
      const meal = updates.meal ?? { name: '', foods: [], time: '' };
      return {
        type: 'meal',
        content: updates.content ?? prev.content,
        url: updates.url ?? prev.url,
        challengeIds: updates.challengeIds ?? prev.challengeIds,
        meal,
        smiley: (updates.challengeIds || prev.challengeIds).length
      };
    });
  };

  const handleWeightUpdate = (updates: Partial<WeightPostData>) => {
    setPostData(prev => {
      const weight = updates.weight ?? { value: 0, unit: 'lbs', time: '' };
      return {
        type: 'weight',
        content: updates.content ?? prev.content,
        url: updates.url ?? prev.url,
        challengeIds: updates.challengeIds ?? prev.challengeIds,
        weight,
        smiley: (updates.challengeIds || prev.challengeIds).length
      };
    });
  };


  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);

      try {
        setLoading(true);

        setAnalysisStatus('Analyzing image...');

        // Analyze the image
        const analysis = await analyzeImage(selectedFile);

        if (analysis.type === 'weight') {
          setAnalysisStatus('Reading weight data...');
        } else if (analysis.type === 'meal') {
          setAnalysisStatus('Identifying meal details...');
        }

        // Create a new state object based on analysis.type
        setPostData((prevData) => {
          const commonData = {
            content: analysis.suggestedData.content || '',
            url: prevData.url, // preserve the URL if needed
            challengeIds: prevData.challengeIds, // keep any selected challenges
            smiley: prevData.challengeIds.length, // recalc or preserve count
          };

          if (analysis.type === 'meal') {
            return {
              type: 'meal',
              ...commonData,
              // Ensure that meal is defined
              meal:
                analysis.suggestedData.meal ?? {
                  name: '',
                  foods: [],
                  calories: 0,
                },
            } as MealPostData;
          } else if (analysis.type === 'weight') {
            return {
              type: 'weight',
              ...commonData,
              // Ensure that weight is defined
              weight:
                analysis.suggestedData.weight ?? {
                  value: 0,
                  unit: 'lbs', // or 'kg' if preferred
                  time: '', // you may want to set a default or current timestamp
                },
            } as WeightPostData;
          } else {
            // default to workout
            return {
              type: 'workout',
              ...commonData,
              // Ensure that exercise is defined (if required by your union)
              exercise:
                analysis.suggestedData.exercise ?? {
                  type: '',
                  intensity: 'medium', // adjust default intensity as needed
                },
            } as WorkoutPostData;
          }
        });
      } catch (error) {
        console.error('Error analyzing image:', error);
        // Optionally, default to workout type if analysis fails
      } finally {
        setLoading(false);
        setStep('details');
      }
    }
  };


  /*
  const handleRemoveImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setStep('initial');
    setPostData({
      type: 'workout',
      content: '',
      url: '',
      challengeIds: [],
      smiley: 0
    });
  };
  */

  const toggleChallenge = (challengeId: string) => {
    const selectability = challengeSelectability[challengeId];
    if (!selectability?.canSelect) return;

    setPostData(prev => {
      const newChallengeIds = prev.challengeIds.includes(challengeId)
        ? prev.challengeIds.filter(id => id !== challengeId)
        : [...prev.challengeIds, challengeId];

      return {
        ...prev,
        challengeIds: newChallengeIds,
        smiley: newChallengeIds.length, // update smiley with the count
      };
    });
  };

  const handleSubmit = async () => {
    if (!file || !userId) {
      onError?.(new Error("Missing required data for post"));
      return;
    }

    try {
      setLoading(true);

      // Validate selected challenges
      if (postData.challengeIds.length > 0) {
        const validationContext: ValidatePostContext = {
          challengeId: postData.challengeIds[0], // Validate first challenge
          userId,
          postId: 'pending',
          timestamp: new Date().toISOString(),
          postType: postData.type,
          content: postData.content,
          measurementData: getMeasurementData()
        };

        const validationResults = await Promise.all(
          postData.challengeIds.map(challengeId =>
            validateChallengePost({
              ...validationContext,
              challengeId
            })
          )
        );

        const invalidResults = validationResults.filter(result => !result.isValid);
        if (invalidResults.length > 0) {
          throw new Error(invalidResults.map(r => r.message).join(', '));
        }
      }

      // Upload image
      const { originalPath } = await uploadImageWithThumbnails(file, 'picture-submissions', 1200);

      // Create base post data
      const basePostData = {
        content: postData.content || '',
        url: originalPath,
        username: userAttributes?.preferred_username || '',
        userID: userId,
        challengeIds: postData.challengeIds,
        postType: postData.type,
        smiley: postData.challengeIds.length
      };

      // Add type-specific data
      const postDataWithMeasurements = {
        ...basePostData,
        ...(postData.type === 'meal' && {
          mealData: JSON.stringify((postData as MealPostData).meal)
        }),
        ...(postData.type === 'weight' && {
          weightData: JSON.stringify((postData as WeightPostData).weight)
        })
      };

      // Create post
      const result = await client.models.PostforWorkout.create(postDataWithMeasurements);

      if (!result.data) {
        throw new Error("Failed to create post");
      }

      // If this is a weight post, update weight in all weight-tracking challenges
      if (postData.type === 'weight' && (postData as WeightPostData).weight?.value) {
        try {
          const weightValue = (postData as WeightPostData).weight.value;

          // Import the utility function
          const { updateUserWeightInChallenges } = await import('./utils/updateChallengeWeight');

          // Update weight in all weight-tracking challenges
          await updateUserWeightInChallenges(userId, weightValue);
        } catch (weightError) {
          console.error('Error updating weight in challenges:', weightError);
          // Continue with the post submission even if weight update fails
        }
      }

      // If this is a workout post linked to specific challenges, increment workout counts
      if (postData.type === 'workout' && postData.challengeIds.length > 0) {
        try {
          // Import the utility function
          const { incrementWorkoutCount } = await import('./utils/updateChallengeWeight');

          // Update workout count for each challenge
          await Promise.all(
            postData.challengeIds.map(challengeId =>
              incrementWorkoutCount(userId, challengeId)
            )
          );
        } catch (workoutError) {
          console.error('Error updating workout counts:', workoutError);
          // Continue with the post submission even if workout update fails
        }
      }

      // Reset form state
      setPostData({
        type: 'workout',
        content: '',
        url: '',
        challengeIds: [],
        smiley: 0
      });
      setFile(null);
      setPreviewUrl(null);
      setStep('initial');
      incrementVersion();
      onSuccess();

    } catch (error) {
      console.error("Error creating post:", error);
      onError?.(error instanceof Error ? error : new Error("Failed to create post"));
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    switch (postData.type) {
      case 'workout':
        return (
          <WorkoutForm
            data={postData as WorkoutPostData}
            onChange={handleWorkoutUpdate}
            isSubmitting={loading}
          />
        );
      case 'meal':
        return (
          <MealForm
            data={postData as MealPostData}
            onChange={handleMealUpdate}
            isSubmitting={loading}
          />
        );
      case 'weight':
        return (
          <WeightForm
            data={postData as WeightPostData}
            onChange={handleWeightUpdate}
            isSubmitting={loading}
          />
        );
      default:
        return null;
    }
  };


  const renderChallengeSelection = () => (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Tag Your Challenges</h3>
      <div className="flex flex-wrap gap-2">
        {availableChallenges.map(challenge => {
          const selectability = challengeSelectability[challenge.id];
          const isSelected = postData.challengeIds.includes(challenge.id);
          const style = getChallengeStyle(
            challenge.challengeType,
            isSelected ? 'selected' : !selectability?.canSelect ? 'disabled' : 'default'
          );

          // Get style which includes the icon component
          const IconComponent = style.icon;

          return (
            <div key={challenge.id} className="relative group">
              <button
                onClick={() => selectability?.canSelect && toggleChallenge(challenge.id)}
                disabled={!selectability?.canSelect}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-full
                  transition-colors duration-200 relative z-10
                `}
                style={{
                  backgroundColor: style.bgColor,
                  borderColor: style.borderColor,
                  color: style.textColor,
                  opacity: style.opacity
                }}
              >
                <IconComponent size={16} />
                <span className="text-sm font-medium">{challenge.title}</span>
              </button>

              {!selectability?.canSelect && selectability?.reason && (
                <div
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
                >
                  {selectability.reason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (step === 'initial') {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white p-4 rounded-lg">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white mb-2"></div>
            <p className="text-sm font-medium">{analysisStatus || 'Analyzing image...'}</p>
          </div>
        )}

        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-900">Share your progress</p>
          <p className="mt-1 text-xs text-gray-500">Click to select a picture</p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4">
        {/* Preview Image */}
        <div className="relative mb-4">
          {previewUrl && (
            <>
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-64 object-cover rounded-lg"
              />

            </>
          )}
        </div>

        {/* Challenge Selection */}
        {renderChallengeSelection()}

        {/* Form Section */}
        {renderForm()}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <button
            onClick={() => setStep('initial')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={loading}
          >
            {loading ? 'Posting...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostCreator;