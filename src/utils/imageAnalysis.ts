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
  matches_description?: boolean;
}

export async function analyzeImage(file: File, description?: string): Promise<ImageAnalysisResult> {
  try {
    console.log('Description:', file);

    const base64Image = await fileToBase64(file);
    
    console.log('Calling imageAnalysis with base64Image length:', base64Image.length);

    // Call our Lambda function via Amplify client
    const response = await client.queries.imageAnalysis({
      base64Image: base64Image,
      args: description || ''  // Pass through description if provided
    });

    console.log('Got response:', response);  // Add this log


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