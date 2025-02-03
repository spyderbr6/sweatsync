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
  matches_description?: boolean; // New field for description validation
}

interface AppSyncEvent {
  arguments: {
    base64Image: string;
    args?: string;
  };
}

export const handler = async (event: AppSyncEvent): Promise<ImageAnalysisResult> => {
  try {
    // No longer need to parse event.body since AppSync provides arguments directly
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

    // Create prompt incorporating user description if provided
    const descriptionPrompt = args 
      ? `The user describes this as: "${args}". Verify if this description matches what you see in the image.`
      : '';

    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this image and identify if it's a workout, meal, or weight tracking photo. 
              ${descriptionPrompt}

              Provide a detailed analysis in a structured JSON format with the following requirements:

              1. Determine the type ('workout', 'meal', or 'weight')
              2. For workouts: Identify the type of exercise and estimate intensity
              3. For meals: List the visible food items and estimate total calories
              4. For weight tracking: Try to read any visible weight values
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
              }`
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
      max_tokens: 500,
    });

    // Parse and validate the response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in GPT-4 Vision response');
    }

    let parsedResult: ImageAnalysisResult;
    try {
      parsedResult = JSON.parse(content) as ImageAnalysisResult;
      
      // Add debug logging
      console.log('Parsed result:', parsedResult);
      
      // Validate the type field
      if (!['workout', 'meal', 'weight'].includes(parsedResult.type)) {
        throw new Error('Invalid post type in response');
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

      // Return the result directly - no need to wrap in response structure
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
    throw error; // AppSync will handle error formatting
  }
};