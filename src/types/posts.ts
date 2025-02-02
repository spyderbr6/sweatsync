// src/types/posts.ts
export type PostType = 'workout' | 'meal' | 'weight';

export interface BasePostData {
  type: PostType;
  content: string;
  url: string;
  challengeIds: string[];
  smiley: number;
}

export interface Exercise {
  type: string;
  duration?: number;
  intensity?: 'low' | 'medium' | 'high';
}

export interface Meal {
  name: string;
  foods: string[];  // Required array, can be empty
  calories?: number;
  time: string;
}

export interface Weight {
  value: number;
  unit: 'lbs' | 'kg';
  time: string;
}

export interface WorkoutPostData extends BasePostData {
  type: 'workout';
  exercise?: Exercise;  // Whole exercise object is optional
}

export interface MealPostData extends BasePostData {
  type: 'meal';
  meal: Meal;  // Meal is required but has optional fields inside
}

export interface WeightPostData extends BasePostData {
  type: 'weight';
  weight: Weight;  // Weight is required with all fields
}

export type PostData = WorkoutPostData | MealPostData | WeightPostData;