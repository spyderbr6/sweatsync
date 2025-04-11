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
  needsDetailedAnalysis?: boolean;
}

// Function to resize the image to a smaller version
async function createLowResImage(file: File, maxWidth: number = 400): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Scale down the image
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate the new dimensions
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Get the resized image as base64
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        resolve(resizedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Original function to convert file to base64
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

export async function analyzeImage(file: File, description?: string): Promise<ImageAnalysisResult> {
  try {
    // Create a low-resolution version for initial classification
    const lowResBase64 = await createLowResImage(file, 400);
    
    console.log('Calling initial image analysis with low-res image');
    
    // First pass with low-res image - just to determine type
    const initialResponse = await client.queries.imageAnalysis({
      base64Image: lowResBase64,
      args: `${description || ''} - preliminary classification`
    });
    
    let result: ImageAnalysisResult;
    
    if (typeof initialResponse.data === 'string') {
      result = JSON.parse(initialResponse.data) as ImageAnalysisResult;
      console.log('Initial classification result:', result);
      
      // For weight images, do a second pass with higher resolution
      if (result.type === 'weight') {
        console.log('Detected weight image, performing detailed analysis with full resolution');
        
        // Get full resolution for detailed analysis
        const fullResBase64 = await fileToBase64(file);
        console.log('Full resolution image size:', fullResBase64.length);
        
        const detailedResponse = await client.queries.imageAnalysis({
          base64Image: fullResBase64,
          args: `This is a weight measurement image. Please read the exact weight value shown on the scale. Look carefully at the numbers and provide the precise measurement.`
        });
        
        if (typeof detailedResponse.data === 'string') {
          // Replace initial results with detailed analysis
          const detailedResult = JSON.parse(detailedResponse.data) as ImageAnalysisResult;
          console.log('Detailed weight analysis result:', detailedResult);
          
          // Ensure we have the weight data
          if (!detailedResult.suggestedData.weight || !detailedResult.suggestedData.weight.value) {
            console.warn('Detailed analysis did not return weight value');
          }
          
          result = detailedResult;
        }
      } 
      // For meal images, do a second pass with higher resolution
      else if (result.type === 'meal') {
        console.log('Detected meal image, performing detailed analysis with full resolution');
        
        // Get full resolution for detailed analysis
        const fullResBase64 = await fileToBase64(file);
        console.log('Full resolution image size:', fullResBase64.length);
        
        const detailedResponse = await client.queries.imageAnalysis({
          base64Image: fullResBase64,
          args: `This is a meal photo. Please carefully analyze the food items and estimate calories if possible.`
        });
        
        if (typeof detailedResponse.data === 'string') {
          // Replace initial results with detailed analysis
          const detailedResult = JSON.parse(detailedResponse.data) as ImageAnalysisResult;
          console.log('Detailed meal analysis result:', detailedResult);
          
          // Ensure we have the meal data
          if (!detailedResult.suggestedData.meal) {
            console.warn('Detailed analysis did not return meal data');
            // Create a basic meal structure if missing
            detailedResult.suggestedData.meal = {
              name: 'Meal',
              foods: [],
              calories: 0
            };
          }
          
          result = detailedResult;
        }
      }
      
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