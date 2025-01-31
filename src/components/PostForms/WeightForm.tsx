// src/components/PostForms/WeightForm.tsx
import React from 'react';
import { WeightPostData, PostData } from '../../types/posts';
interface BaseFormProps<T extends PostData> {
    data: Partial<T>;
    onChange: (data: Partial<T>) => void;
    isSubmitting?: boolean;
  }
  
  export const WeightForm: React.FC<BaseFormProps<WeightPostData>> = ({
    data,
    onChange,
    isSubmitting
  }) => {
    // Initialize weight object with required fields if it doesn't exist
    const updateWeight = (updates: Partial<WeightPostData['weight']>) => {
      const currentWeight = data.weight || { value: 0, unit: 'lbs', time: '' };
      onChange({
        ...data,
        weight: {
          ...currentWeight,
          ...updates
        }
      });
    };
  
    return (
      <div className="space-y-4">
        <div>
          <textarea
            value={data.content || ''}
            onChange={(e) => onChange({ ...data, content: e.target.value })}
            placeholder="Share any notes about your weigh-in..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-none"
            disabled={isSubmitting}
          />
        </div>
  
        <div>
          <label 
            htmlFor="weightValue" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Weight
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              id="weightValue"
              value={data.weight?.value || ''}
              onChange={(e) => updateWeight({ value: Number(e.target.value) })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              step="0.1"
              placeholder="Enter weight"
              disabled={isSubmitting}
            />
            <select
              value={data.weight?.unit || 'lbs'}
              onChange={(e) => updateWeight({ unit: e.target.value as 'lbs' | 'kg' })}
              className="w-24 px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            >
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </div>
  
        <div>
          <label 
            htmlFor="weightTime" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Time
          </label>
          <input
            type="time"
            id="weightTime"
            value={data.weight?.time || ''}
            onChange={(e) => updateWeight({ time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSubmitting}
          />
        </div>
      </div>
    );
  };