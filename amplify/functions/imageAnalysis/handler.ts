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

export async function handler(event: APIGatewayEvent, context: Context) {
  try {

    // Log the incoming event for debugging
    console.log('Event:', {
      body: event.body ? JSON.stringify(event.body) : 'no body',
      headers: event.headers,
      isBase64Encoded: event.isBase64Encoded
    });

    // Check if event.body exists and handle both string and object cases
    const requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    
    if (!requestBody) {
      throw new Error('Missing request body');
    }

    const { base64Image, args } = requestBody;

    if (!base64Image) {
      throw new Error('Missing base64Image in request body');
    }

    // 2. Initialize OpenAI client
    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const openai = new OpenAI({ apiKey: openAiApiKey });

    // 3. Create prompt incorporating user description if provided
    const descriptionPrompt = args
      ? `The user describes this as: "${args}". Verify if this description matches what you see in the image.`
      : '';

    // Since the OpenAI SDK expects each message’s content to be a string,
    // but we need to send a structured (multimodal) payload,
    // we use a type assertion (casting to `any`) to bypass type checking.
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        ({
          role: 'user',
          // NOTE: The type for content is normally string. We are bypassing it here.
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
        } as any)
      ],
      max_tokens: 500,
    });

    // 4. Parse and validate the response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in GPT-4 Vision response');
    }

    let parsedResult: ImageAnalysisResult;
    try {
      parsedResult = JSON.parse(content);

      // Debug logging
      console.log('Parsed result:', parsedResult);

      // Validate the type field
      if (!['workout', 'meal', 'weight'].includes(parsedResult.type)) {
        throw new Error('Invalid post type in response');
      }

      // Remove null fields from suggestedData.
      // We cast the keys array so that TypeScript knows they are keys of suggestedData.
      if (parsedResult.suggestedData) {
        (Object.keys(parsedResult.suggestedData) as Array<
          keyof ImageAnalysisResult['suggestedData']
        >).forEach((key) => {
          if (parsedResult.suggestedData[key] === null) {
            delete parsedResult.suggestedData[key];
          }
        });
      }
    } catch (error) {
      console.error('Error parsing GPT-4 Vision response.', {
        error,
        content,
        contentType: typeof content,
      });
      throw new Error('Failed to parse GPT-4 Vision response');
    }

    // 5. Return the structured response
    return parsedResult;  // Don't wrap in {statusCode, body, headers}

  } catch (error: any) {
    console.error('Error in image analysis:', error);

    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
}
