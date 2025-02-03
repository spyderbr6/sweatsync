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
    const base64Image = await fileToBase64(file);
    
    console.log('Calling imageAnalysis with payload size:', base64Image.length);

    const response = await client.queries.imageAnalysis({
      base64Image,
      args: description || ''
    });

    console.log('Response received:', response);

    // Parse the first layer of JSON (from the response.data string)
    if (typeof response.data === 'string') {
      const parsedResponse = JSON.parse(response.data);
      
      // Parse the body which is another JSON string
      const parsedBody = JSON.parse(parsedResponse.body);

      // If there's an error in the body
      if (parsedBody.error) {
        throw new Error(parsedBody.error);
      }

      // If we have data, it should be our analysis result
      if (parsedBody.data) {
        const result = parsedBody.data as ImageAnalysisResult;
        
        // Validate the type
        if (!['workout', 'meal', 'weight'].includes(result.type)) {
          console.warn('Invalid type received from analysis:', result.type);
          return {
            type: 'workout',
            suggestedData: {}
          };
        }

        return result;
      }
    }

    throw new Error('Invalid response format from analysis');

  } catch (error) {
    console.error('Error analyzing image:', error);
    // Default to workout type if analysis fails
    return {
      type: 'workout',
      suggestedData: {}
    };
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
}