// src/components/challengeGoal/challengeGoalComponent.tsx
import React, { useState, useEffect } from 'react';
import { Scale, Utensils, Dumbbell, Edit, CheckCircle } from 'lucide-react';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import { useUser } from '../../userContext';

const client = generateClient<Schema>();

interface ChallengeGoalComponentProps {
  challengeId: string;
  trackWeight: boolean;
  trackMeals: boolean;
  trackWorkouts: boolean;
  onGoalUpdate?: () => void;
}

interface GoalState {
  targetWeight: number | null;
  startingWeight: number | null;
  calorieGoal: number | null;
  workoutGoal: number | null;
  isEditing: 'weight' | 'calories' | 'workouts' | null;
}

export const ChallengeGoalComponent: React.FC<ChallengeGoalComponentProps> = ({
  challengeId,
  trackWeight,
  trackMeals,
  trackWorkouts,
  onGoalUpdate
}) => {
  const { userId } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [participation, setParticipation] = useState<Schema['ChallengeParticipant']['type'] | null>(null);
  const [goalState, setGoalState] = useState<GoalState>({
    targetWeight: null,
    startingWeight: null,
    calorieGoal: null,
    workoutGoal: null,
    isEditing: null
  });

  // Load user's participation data for this challenge
  useEffect(() => {
    const loadParticipation = async () => {
      if (!userId || !challengeId) return;

      try {
        setLoading(true);
        setError(null);
        
        const participationResult = await client.models.ChallengeParticipant.list({
          filter: {
            challengeID: { eq: challengeId },
            userID: { eq: userId },
            status: { eq: 'ACTIVE' }
          }
        });

        if (participationResult.data && participationResult.data.length > 0) {
          const participantData = participationResult.data[0];
          setParticipation(participantData);
          
          // Initialize goal state from participation data
          setGoalState({
            targetWeight: participantData.targetWeight || null,
            startingWeight: participantData.startingWeight || null,
            calorieGoal: participantData.calorieGoal || null,
            workoutGoal: null, // Workout goal isn't in the schema, we'll need to add it or handle differently
            isEditing: null
          });
        }
      } catch (err) {
        console.error('Error loading participation data:', err);
        setError('Failed to load your challenge goals');
      } finally {
        setLoading(false);
      }
    };

    loadParticipation();
  }, [userId, challengeId]);

  const handleEditClick = (goalType: 'weight' | 'calories' | 'workouts') => {
    setGoalState(prev => ({
      ...prev,
      isEditing: goalType
    }));
  };

  const handleCancelEdit = () => {
    setGoalState(prev => ({
      ...prev,
      isEditing: null
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericValue = parseFloat(value);
    
    if (!isNaN(numericValue)) {
      setGoalState(prev => ({
        ...prev,
        [name]: numericValue
      }));
    }
  };

  const handleSaveGoal = async () => {
    if (!userId || !challengeId || !participation) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Update participation record with new goal values
      await client.models.ChallengeParticipant.update({
        id: participation.id,
        targetWeight: goalState.isEditing === 'weight' ? goalState.targetWeight : participation.targetWeight,
        startingWeight: goalState.isEditing === 'weight' ? goalState.startingWeight : participation.startingWeight,
        calorieGoal: goalState.isEditing === 'calories' ? goalState.calorieGoal : participation.calorieGoal,
        updatedAt: new Date().toISOString()
      });
      
      // Reset editing state
      setGoalState(prev => ({
        ...prev,
        isEditing: null
      }));
      
      // Show success message
      setSuccess('Goal updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
      // Trigger parent component update if provided
      if (onGoalUpdate) {
        onGoalUpdate();
      }
    } catch (err) {
      console.error('Error updating goal:', err);
      setError('Failed to update your goal');
    } finally {
      setLoading(false);
    }
  };

  // Calculate progress percentage for each goal
  const calculateWeightProgress = () => {
    if (!goalState.startingWeight || !goalState.targetWeight) return 0;
    
    const startWeight = goalState.startingWeight;
    const targetWeight = goalState.targetWeight;
    const currentWeight = participation?.currentWeight || startWeight;
    
    // Calculate progress based on whether it's weight loss or gain
    if (targetWeight < startWeight) {
      // Weight loss goal
      const totalToLose = startWeight - targetWeight;
      const lostSoFar = startWeight - currentWeight;
      return Math.min(100, Math.max(0, (lostSoFar / totalToLose) * 100));
    } else {
      // Weight gain goal
      const totalToGain = targetWeight - startWeight;
      const gainedSoFar = currentWeight - startWeight;
      return Math.min(100, Math.max(0, (gainedSoFar / totalToGain) * 100));
    }
  };

  if (loading && !participation) {
    return <div className="text-center py-8 text-gray-500">Loading your goals...</div>;
  }

  if (!trackWeight && !trackMeals && !trackWorkouts) {
    return null; // Don't show this component if no tracking is enabled
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">My Goals for this Challenge</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-4 flex justify-between items-center">
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-xl"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-md mb-4 flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trackWeight && (
          <div className="bg-gray-50 rounded-lg p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center mb-4">
              <div className="bg-blue-100 text-blue-600 p-2 rounded-full mr-3">
                <Scale size={20} />
              </div>
              <h4 className="text-lg font-medium text-gray-700 flex-1">Weight Goal</h4>
              {goalState.isEditing !== 'weight' && (
                <button 
                  onClick={() => handleEditClick('weight')}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1 rounded-full"
                  aria-label="Edit weight goal"
                >
                  <Edit size={16} />
                </button>
              )}
            </div>
            
            {goalState.isEditing === 'weight' ? (
              <div className="bg-gray-100 rounded-md p-4 mt-2">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Starting Weight (lbs)</label>
                  <input
                    type="number"
                    name="startingWeight"
                    value={goalState.startingWeight || ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="0.1"
                    min="0"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Weight (lbs)</label>
                  <input
                    type="number"
                    name="targetWeight"
                    value={goalState.targetWeight || ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="0.1"
                    min="0"
                  />
                </div>
                
                <div className="flex justify-end gap-2 mt-4">
                  <button 
                    onClick={handleCancelEdit}
                    className="bg-white text-gray-600 border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveGoal}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!goalState.startingWeight || !goalState.targetWeight}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {goalState.targetWeight && goalState.startingWeight ? (
                  <>
                    <div className="flex justify-between mb-4">
                      <div className="text-center">
                        <span className="text-xs text-gray-500 block">Starting</span>
                        <span className="text-lg font-semibold text-gray-900">{goalState.startingWeight} lbs</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs text-gray-500 block">Target</span>
                        <span className="text-lg font-semibold text-gray-900">{goalState.targetWeight} lbs</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs text-gray-500 block">Current</span>
                        <span className="text-lg font-semibold text-gray-900">{participation?.currentWeight || goalState.startingWeight} lbs</span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${calculateWeightProgress()}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 text-right block">
                        {Math.round(calculateWeightProgress())}% Complete
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 mb-4">Set your weight goal for this challenge</p>
                    <button 
                      onClick={() => handleEditClick('weight')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      Set Goal
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {trackMeals && (
          <div className="bg-gray-50 rounded-lg p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center mb-4">
              <div className="bg-green-100 text-green-600 p-2 rounded-full mr-3">
                <Utensils size={20} />
              </div>
              <h4 className="text-lg font-medium text-gray-700 flex-1">Calorie Goal</h4>
              {goalState.isEditing !== 'calories' && (
                <button 
                  onClick={() => handleEditClick('calories')}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1 rounded-full"
                  aria-label="Edit calorie goal"
                >
                  <Edit size={16} />
                </button>
              )}
            </div>
            
            {goalState.isEditing === 'calories' ? (
              <div className="bg-gray-100 rounded-md p-4 mt-2">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily Calorie Target</label>
                  <input
                    type="number"
                    name="calorieGoal"
                    value={goalState.calorieGoal || ''}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="10"
                    min="0"
                  />
                </div>
                
                <div className="flex justify-end gap-2 mt-4">
                  <button 
                    onClick={handleCancelEdit}
                    className="bg-white text-gray-600 border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveGoal}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!goalState.calorieGoal}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {goalState.calorieGoal ? (
                  <>
                    <div className="flex justify-center mb-4">
                      <div className="text-center">
                        <span className="text-xs text-gray-500 block">Daily Target</span>
                        <span className="text-lg font-semibold text-gray-900">{goalState.calorieGoal} cal</span>
                      </div>
                    </div>
                    
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-sm text-amber-700 rounded">
                      <p>Track your meals to see your progress toward your daily calorie goal</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 mb-4">Set your daily calorie goal for this challenge</p>
                    <button 
                      onClick={() => handleEditClick('calories')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      Set Goal
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {trackWorkouts && (
          <div className="bg-gray-50 rounded-lg p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center mb-4">
              <div className="bg-purple-100 text-purple-600 p-2 rounded-full mr-3">
                <Dumbbell size={20} />
              </div>
              <h4 className="text-lg font-medium text-gray-700 flex-1">Workout Goal</h4>
            </div>
            
            <div>
              <div className="flex justify-between mb-4">
                <div className="text-center">
                  <span className="text-xs text-gray-500 block">Required</span>
                  <span className="text-lg font-semibold text-gray-900">{participation?.workoutsRequired || 0}</span>
                </div>
                <div className="text-center">
                  <span className="text-xs text-gray-500 block">Completed</span>
                  <span className="text-lg font-semibold text-gray-900">{participation?.workoutsCompleted || 0}</span>
                </div>
              </div>
              
              {/* Workout progress bar */}
              {participation && participation.workoutsRequired && participation.workoutsRequired > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                    <div 
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ 
                        width: `${Math.min(100, ((participation.workoutsCompleted || 0) / participation.workoutsRequired) * 100)}%`
                      }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500 text-right block">
                    {Math.round(((participation.workoutsCompleted || 0) / participation.workoutsRequired) * 100)}% Complete
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};