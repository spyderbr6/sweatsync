// src/utils/imageAnalysis.ts
import OpenAI from 'openai';
import { PostType } from '../types/posts';

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
    
    const openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and determine if it's a workout, meal, or weight tracking photo. " +
                    "Return a JSON response with the type and relevant details like exercise type, " +
                    "food items, calories estimate, or weight value. Format: " +
                    "{ type: 'workout'|'meal'|'weight', suggestedData: {...} }"
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image
              }
            }
          ]
        }
      ],
      max_tokens: 300,
    });

    // Parse the response
    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      type: result.type || 'workout',
      suggestedData: result.suggestedData || {}
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    // Default to workout type if analysis fails
    return {
      type: 'workout',
      suggestedData: {}
    };
  }
}

// Helper function to convert File to base64
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