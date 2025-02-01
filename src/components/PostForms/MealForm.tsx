// src/components/PostForms/MealForm.tsx
import React from 'react';
import { MealPostData, PostData } from '../../types/posts';

interface BaseFormProps<T extends PostData> {
  data: Partial<T>;
  onChange: (data: Partial<T>) => void;
  isSubmitting?: boolean;
}

export const MealForm: React.FC<BaseFormProps<MealPostData>> = ({
  data,
  onChange,
  isSubmitting
}) => {
  // Initialize meal object with required fields if it doesn't exist
  const updateMeal = (updates: Partial<MealPostData['meal']>) => {
    const currentMeal = data.meal || { name: '', foods: [], time: '' };
    onChange({
      ...data,
      meal: {
        ...currentMeal,
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
          placeholder="Share details about your meal..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-none"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label 
          htmlFor="mealName" 
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Meal Type
        </label>
        <select
          id="mealName"
          value={data.meal?.name || ''}
          onChange={(e) => updateMeal({ name: e.target.value })}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isSubmitting}
        >
          <option value="">Select meal type</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Dinner">Dinner</option>
          <option value="Snack">Snack</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label 
            htmlFor="calories" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Calories
            <span className="text-gray-500 text-xs ml-1">(optional)</span>
          </label>
          <input
            type="number"
            id="calories"
            value={data.meal?.calories || ''}
            onChange={(e) => updateMeal({ 
              calories: e.target.value ? Number(e.target.value) : undefined 
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter calories"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label 
            htmlFor="mealTime" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Time
          </label>
          <input
            type="time"
            id="mealTime"
            value={data.meal?.time || ''}
            onChange={(e) => updateMeal({ time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
};