// src/postCreator.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
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
import { getChallengeStyle} from './styles/challengeStyles';

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

  // Initialize with a complete workout post data
  const [postData, setPostData] = useState<PostData>({
    type: 'workout',
    content: '',
    url: '',
    challengeIds: []
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
      type: 'workout'
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
        meal
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
        weight
      };
    });
  };


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
      challengeIds: []
    });
  };

  const toggleChallenge = (challengeId: string) => {
    const selectability = challengeSelectability[challengeId];
    if (!selectability?.canSelect) return;
  
    setPostData(prev => ({
      ...prev,
      challengeIds: prev.challengeIds.includes(challengeId)
        ? prev.challengeIds.filter(id => id !== challengeId)
        : [...prev.challengeIds, challengeId]
    }));
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
        postType: postData.type
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
  
      // Reset form state
      setPostData({
        type: 'workout',
        content: '',
        url: '',
        challengeIds: []
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
                  transition-colors duration-200
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
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
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
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                aria-label="Remove image"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
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