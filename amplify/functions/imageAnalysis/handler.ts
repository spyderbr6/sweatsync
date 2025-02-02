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
}

export async function handler(event: APIGatewayEvent, context: Context) {
  try {
    // 1. Validate input
    if (!event.body) {
      throw new Error('Missing request body');
    }

    const body = JSON.parse(event.body);
    const base64Image = body.base64Image;

    if (!base64Image) {
      throw new Error('Missing base64Image in request body');
    }

    // 2. Initialize OpenAI client
    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const openai = new OpenAI({ apiKey: openAiApiKey });
    console.log('OPENAI_API_KEY', process.env.OPENAI_API_KEY);

    // 3. Create a structured prompt for GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this image and identify if it's a workout, meal, or weight tracking photo. 
              Provide a detailed analysis in a structured JSON format with the following requirements:

              1. Determine the type ('workout', 'meal', or 'weight')
              2. For workouts: Identify the type of exercise and estimate intensity
              3. For meals: List the visible food items and estimate total calories
              4. For weight tracking: Try to read any visible weight values
              5. Provide a brief descriptive content suggestion

              Return ONLY a JSON object matching this structure:
              {
                "type": "workout"|"meal"|"weight",
                "suggestedData": {
                  "content": "string",
                  "exercise": { "type": "string", "intensity": "low"|"medium"|"high" },
                  "meal": { "name": "string", "foods": ["string"], "calories": number },
                  "weight": { "value": number, "unit": "lbs"|"kg" }
                }
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

    // 4. Parse and validate the response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in GPT-4 Vision response');
    }

    let parsedResult: ImageAnalysisResult;
    try {
      parsedResult = JSON.parse(content);
      
      // Validate the type field
      if (!['workout', 'meal', 'weight'].includes(parsedResult.type)) {
        throw new Error('Invalid post type in response');
      }
    } catch (error) {
      console.error('Error parsing GPT-4 Vision response:', content);
      throw new Error('Failed to parse GPT-4 Vision response');
    }

    // 5. Return the structured response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: parsedResult
      }),
    };

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