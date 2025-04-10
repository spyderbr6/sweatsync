// amplify/functions/imageAnalysis/handler.ts (with progressive analysis support)
import { APIGatewayEvent, Context } from 'aws-lambda';
import OpenAI from 'openai';

type PostType = 'workout' | 'meal' | 'weight';

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
  needsDetailedAnalysis?: boolean; // Added this property
}

interface AppSyncEvent {
  arguments: {
    base64Image: string;
    args?: string;
  };
}

export const handler = async (event: AppSyncEvent): Promise<ImageAnalysisResult> => {
  try {
    const { base64Image, args } = event.arguments;

    if (!base64Image) {
      throw new Error('Missing base64Image in request');
    }

    // Initialize OpenAI client
    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const openai = new OpenAI({ apiKey: openAiApiKey });
    
    // Check if this is a preliminary analysis or detailed analysis
    const isPreliminary = args?.includes('preliminary classification') || false;
    const isDetailed = args?.includes('detailed') || false;
    
    // Create the appropriate prompt based on analysis type
    let promptText = '';
    
    if (isPreliminary) {
      // For preliminary classification, we just need to determine the type
      promptText = `Analyze this image and identify if it's a workout, meal, or weight tracking photo. 
      ${args ? `The user describes this as: "${args.replace('- preliminary classification', '')}"` : ''}
      
      Return ONLY a simple JSON with the image type like this:
      {
        "type": "workout"|"meal"|"weight",
        "suggestedData": {}
      }
      
      Be very conservative with "weight" classification - only classify as weight if you clearly see a scale or weight measurement.`;
    } else if (isDetailed) {
      // For detailed analysis, focus on precise readings of numbers and values
      const analysisType = args?.includes('weight') ? 'weight' : 'meal';
      
      if (analysisType === 'weight') {
        promptText = `This is a weight tracking photo. Please carefully analyze the image and read the exact weight value shown on the scale. 
        ${args ? `The user describes this as: "${args.replace('- detailed weight analysis, please read numbers carefully', '')}"` : ''}
        
        Pay special attention to the numbers displayed. Provide a detailed analysis in JSON format with the following:
        
        1. The precise weight value you can read (be exact with decimal points)
        2. The unit of measurement (lbs or kg)
        3. A brief content suggestion for the user's post
        
        Return ONLY a JSON object matching this structure:
        {
          "type": "weight",
          "suggestedData": {
            "content": "string",
            "weight": { "value": number, "unit": "lbs"|"kg" }
          }
        }`;
      } else {
        promptText = `This is a meal photo. Please carefully analyze the food items and estimate calories.
        ${args ? `The user describes this as: "${args.replace('- detailed meal analysis, please read numbers carefully', '')}"` : ''}
        
        Pay special attention to any calorie information if visible. Provide a detailed analysis in JSON format with the following:
        
        1. The name of the meal
        2. List of visible food items
        3. Estimated total calories based on portion size and components
        4. A brief content suggestion for the user's post
        
        Return ONLY a JSON object matching this structure:
        {
          "type": "meal",
          "suggestedData": {
            "content": "string",
            "meal": { "name": "string", "foods": ["string"], "calories": number }
          }
        }`;
      }
    } else {
      // Standard full analysis (for workout images or when no specific mode is indicated)
      promptText = `Analyze this image and identify if it's a workout, meal, or weight tracking photo. 
      ${args ? `The user describes this as: "${args}". Verify if this description matches what you see in the image.` : ''}

      Provide a detailed analysis in a structured JSON format with the following requirements:

      1. Determine the type ('workout', 'meal', or 'weight')
      2. For workouts: Identify the type of exercise and estimate intensity
      3. For meals: List the visible food items and estimate total calories based on portion size and components of the meal.
      4. For weight tracking: Try to read any visible weight values. Your accuracy on weight measurement must be high.
      5. Provide a brief descriptive content suggestion
      ${args ? '6. Include "matches_description": true/false based on if the image matches the user description' : ''}

      Return ONLY a JSON object matching this structure:
      {
        "type": "workout"|"meal"|"weight",
        "suggestedData": {
          "content": "string",
          "exercise": { "type": "string", "intensity": "low"|"medium"|"high" },
          "meal": { "name": "string", "foods": ["string"], "calories": number },
          "weight": { "value": number, "unit": "lbs"|"kg" }
        }${args ? ',\n"matches_description": boolean' : ''}
      }`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: promptText
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      // Use fewer tokens for preliminary classification
      max_tokens: isPreliminary ? 150 : 500,
    });

    // Parse and validate the response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in GPT-4 Vision response');
    }

    let parsedResult: ImageAnalysisResult;
    try {
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      console.log('Cleaned content:', cleanedContent);

      parsedResult = JSON.parse(cleanedContent) as ImageAnalysisResult;
      
      console.log('Parsed result:', parsedResult);
      
      // Validate the type field
      if (!['workout', 'meal', 'weight'].includes(parsedResult.type)) {
        throw new Error('Invalid post type in response');
      }

      // If this is preliminary and we need more detail, indicate this in the result
      if (isPreliminary && (parsedResult.type === 'weight' || parsedResult.type === 'meal')) {
        parsedResult.needsDetailedAnalysis = true;
      }

      // Remove null fields from suggestedData
      if (parsedResult.suggestedData) {
        Object.keys(parsedResult.suggestedData).forEach(key => {
          const typedKey = key as keyof typeof parsedResult.suggestedData;
          if (parsedResult.suggestedData[typedKey] === null) {
            delete parsedResult.suggestedData[typedKey];
          }
        });
      }

      return parsedResult;
    } catch (error) {
      console.error('Error parsing GPT-4 Vision response:', {
        error,
        content,
        contentType: typeof content
      });
      throw error;
    }
  } catch (error) {
    console.error('Error in image analysis:', error);
    throw error;
  }
};