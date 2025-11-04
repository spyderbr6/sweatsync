// src/postCreator.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../amplify/data/resource";
import { PostData, WorkoutPostData, MealPostData, WeightPostData, PostType } from './types/posts';
import { useUser } from './userContext';
import { useDataVersion } from './dataVersionContext';
import { uploadImageWithThumbnails } from './utils/imageUploadUtils';
import { WorkoutForm } from './components/PostForms/WorkoutForm';
import { MealForm } from './components/PostForms/MealForm';
import { WeightForm } from './components/PostForms/WeightForm';
import { StepIndicator } from './components/StepIndicator/StepIndicator';
import { PostTypeSelector } from './components/PostTypeSelector/PostTypeSelector';
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
  const [step, setStep] = useState<'initial' | 'details' | 'challenges'>('initial');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [detectedType, setDetectedType] = useState<PostType | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handlePostTypeChange = (newType: PostType) => {
    // When type changes, preserve content and challengeIds but update type-specific data
    const commonData = {
      content: postData.content,
      url: postData.url,
      challengeIds: postData.challengeIds,
      smiley: postData.challengeIds.length
    };

    if (newType === 'meal') {
      setPostData({
        type: 'meal',
        ...commonData,
        meal: (postData.type === 'meal' ? (postData as MealPostData).meal : { name: '', foods: [], calories: 0, time: '' })
      } as MealPostData);
    } else if (newType === 'weight') {
      setPostData({
        type: 'weight',
        ...commonData,
        weight: (postData.type === 'weight' ? (postData as WeightPostData).weight : { value: 0, unit: 'lbs', time: '' })
      } as WeightPostData);
    } else {
      setPostData({
        type: 'workout',
        ...commonData,
        exercise: (postData.type === 'workout' ? (postData as WorkoutPostData).exercise : { type: '', intensity: 'medium' })
      } as WorkoutPostData);
    }
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
        setAnalyzingImage(true);
        // Analyze the image
        const analysis = await analyzeImage(selectedFile);
        setDetectedType(analysis.type);

        // Create a new state object based on analysis.type
        setPostData((prevData) => {
          const commonData = {
            content: analysis.suggestedData.content || '',
            url: prevData.url,
            challengeIds: prevData.challengeIds,
            smiley: prevData.challengeIds.length,
          };

          if (analysis.type === 'meal') {
            return {
              type: 'meal',
              ...commonData,
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
              weight:
                analysis.suggestedData.weight ?? {
                  value: 0,
                  unit: 'lbs',
                  time: '',
                },
            } as WeightPostData;
          } else {
            return {
              type: 'workout',
              ...commonData,
              exercise:
                analysis.suggestedData.exercise ?? {
                  type: '',
                  intensity: 'medium',
                },
            } as WorkoutPostData;
          }
        });
      } catch (error) {
        console.error('Error analyzing image:', error);
        // Default to workout type if analysis fails
        setDetectedType('workout');
      } finally {
        setAnalyzingImage(false);
        setStep('details');
      }
    }
  };

  const handleChangePhoto = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setDetectedType(undefined);
    setStep('initial');
    // Keep the content and form data in case user wants to reuse it
  };

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
        smiley: newChallengeIds.length,
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
          challengeId: postData.challengeIds[0],
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
          const { updateUserWeightInChallenges } = await import('./utils/updateChallengeWeight');
          await updateUserWeightInChallenges(userId, weightValue);
        } catch (weightError) {
          console.error('Error updating weight in challenges:', weightError);
        }
      }

      // If this is a workout post linked to specific challenges, increment workout counts
      if (postData.type === 'workout' && postData.challengeIds.length > 0) {
        try {
          const { incrementWorkoutCount } = await import('./utils/updateChallengeWeight');
          await Promise.all(
            postData.challengeIds.map(challengeId =>
              incrementWorkoutCount(userId, challengeId)
            )
          );
        } catch (workoutError) {
          console.error('Error updating workout counts:', workoutError);
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
      setDetectedType(undefined);
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

  const renderChallengeSelection = () => {
    if (availableChallenges.length === 0) return null;

    return (
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Tag Challenges <span className="text-gray-500 font-normal">(optional)</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableChallenges.map(challenge => {
            const selectability = challengeSelectability[challenge.id];
            const isSelected = postData.challengeIds.includes(challenge.id);
            const style = getChallengeStyle(
              challenge.challengeType,
              isSelected ? 'selected' : !selectability?.canSelect ? 'disabled' : 'default'
            );

            const IconComponent = style.icon;

            return (
              <div key={challenge.id} className="relative group">
                <button
                  type="button"
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
  };

  // Step 1: Image Selection
  if (step === 'initial') {
    return (
      <div className="p-4 bg-white rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Post</h2>
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <p className="text-base font-medium text-gray-900 mb-1">Share your progress</p>
          <p className="text-sm text-gray-500">Click to select a photo</p>
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

  // Step 2 & 3: Details and Challenges (combined for better UX)
  const currentStepNumber = step === 'details' ? 2 : 3;
  const steps = ['Photo', 'Details', 'Review'];

  return (
    <div className="bg-white rounded-lg">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Post</h2>

        {/* Step Indicator */}
        <StepIndicator
          currentStep={currentStepNumber}
          totalSteps={2}
          steps={['Photo', 'Details']}
        />

        {/* Analyzing Image Overlay */}
        {analyzingImage && (
          <div className="mb-4 flex items-center justify-center py-8 bg-blue-50 rounded-lg border border-blue-200">
            <Loader2 className="animate-spin h-6 w-6 text-blue-600 mr-3" />
            <span className="text-blue-900 font-medium">Analyzing your image...</span>
          </div>
        )}

        {/* Image Preview with Change Button */}
        <div className="relative mb-4">
          {previewUrl && (
            <>
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-64 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={handleChangePhoto}
                className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium shadow-md transition-all flex items-center gap-2"
                disabled={loading}
              >
                <ImageIcon size={16} />
                Change Photo
              </button>
            </>
          )}
        </div>

        {!analyzingImage && (
          <>
            {/* Post Type Selector */}
            <PostTypeSelector
              selectedType={postData.type}
              detectedType={detectedType}
              onChange={handlePostTypeChange}
              disabled={loading}
            />

            {/* Form Section - Description and Type-Specific Fields */}
            {renderForm()}

            {/* Challenge Selection - Moved to end */}
            {renderChallengeSelection()}
          </>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between gap-3 mt-6 pt-4 border-t">
          <button
            type="button"
            onClick={handleChangePhoto}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={loading || analyzingImage}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={loading || analyzingImage}
          >
            {loading && <Loader2 className="animate-spin h-4 w-4" />}
            {loading ? 'Posting...' : 'Share Post'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostCreator;
