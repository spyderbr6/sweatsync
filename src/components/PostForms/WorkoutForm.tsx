
// src/components/PostForms/WorkoutForm.tsx
import React from 'react';
import { WorkoutPostData, PostData } from '../../types/posts';

interface BaseFormProps<T extends PostData> {
  data: Partial<T>;
  onChange: (data: Partial<T>) => void;
  isSubmitting?: boolean;
}

export const WorkoutForm: React.FC<BaseFormProps<WorkoutPostData>> = ({
  data,
  onChange,
  isSubmitting
}) => {
  
  /*
  // Initialize exercise object with required fields if it doesn't exist
  const updateExercise = (updates: Partial<WorkoutPostData['exercise']>) => {
    const currentExercise = data.exercise || { type: '' };
    onChange({
      ...data,
      exercise: {
        ...currentExercise,
        ...updates
      }
    });
  };
  */

  return (
    <div className="space-y-4">
      <div>
        <textarea
          value={data.content || ''}
          onChange={(e) => onChange({ ...data, content: e.target.value })}
          placeholder="Share details about your workout..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-none"
          disabled={isSubmitting}
        />
      </div>
{/*
      <div>
        <label 
          htmlFor="exerciseType" 
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Exercise Type
        </label>
        <select
          id="exerciseType"
          value={data.exercise?.type || ''}
          onChange={(e) => updateExercise({ type: e.target.value })}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isSubmitting}
        >
          <option value="">Select type</option>
          <option value="Lifting">Weight Training</option>
          <option value="Running">Running</option>
          <option value="Cycling">Cycling</option>
          <option value="Yoga">Yoga</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label 
            htmlFor="duration" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Duration (minutes)
          </label>
          <input
            type="number"
            id="duration"
            value={data.exercise?.duration || ''}
            onChange={(e) => updateExercise({ duration: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSubmitting}
            min="0"
          />
        </div>

        <div>
          <label 
            htmlFor="intensity" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Intensity
          </label>
          <select
            id="intensity"
            value={data.exercise?.intensity || ''}
            onChange={(e) => updateExercise({ intensity: e.target.value as 'low' | 'medium' | 'high' | undefined })}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSubmitting}
          >
            <option value="">Select intensity</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      */}
    </div>
    
  );
};