// src/utils/imageAnalysis.ts
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../amplify/data/resource";
import { PostType } from '../types/posts';

const client = generateClient<Schema>();

interface ImageAnalysisResult {
  type: PostType;
  suggestedData: {
    content?: string;
    exercise?: {
      type?: string;
      intensity?: 'low' | 'medium' | 'high';
    };
    meal?: {
      name?: string;
      foods: string[];
      calories?: number;
    };
    weight?: {
      value?: number;
      unit?: 'lbs' | 'kg';
    };
  };
}

export async function analyzeImage(file: File): Promise<ImageAnalysisResult> {
  try {
    const base64Image = await fileToBase64(file);
    
    // Call our Lambda function via Amplify client
    const response = await client.queries.imageAnalysis({
      imageUrl: base64Image,
      args: '' // Optional arguments if needed
    });

    if (!response.data) {
      throw new Error('No response data from image analysis');
    }

    // Parse and validate the response
    const result = response.data as ImageAnalysisResult;
    
    // Validate the type
    if (!['workout', 'meal', 'weight'].includes(result.type)) {
      console.warn('Invalid type received from analysis, defaulting to workout');
      return {
        type: 'workout',
        suggestedData: {}
      };
    }

    return result;

  } catch (error) {
    console.error('Error analyzing image:', error);
    // Default to workout type if analysis fails
    return {
      type: 'workout',
      suggestedData: {}
    };
  }
}

// Keep our existing helper function
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
}