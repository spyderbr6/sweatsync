import { APIGatewayEvent, Context } from 'aws-lambda';
import OpenAI from 'openai';

// The named export "handler" matches what we're referencing in resource.ts ("dist/handler.handler")
export async function handler(event: APIGatewayEvent, context: Context) {
  try {
    // 1. Parse the incoming request body for the base64 image
    const body = JSON.parse(event.body ?? '{}');
    const base64Image = body.base64Image;

    // 2. Retrieve API key from environment (injected via secret('OPENAI_API_KEY'))
    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY not configured in environment.");
    }

    // 3. Create an OpenAI client
    const openai = new OpenAI({ apiKey: openAiApiKey });

    // 4. Call OpenAI GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image and determine if it’s a workout, meal, or weight tracking photo...'
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image
              }
            }
          ]
        }
      ],
      max_tokens: 300,
    });

    // 5. Return JSON back to the caller
    return {
      statusCode: 200,
      body: JSON.stringify({
        data: response.choices?.[0].message?.content ?? "No content returned",
      }),
    };
  } catch (error: any) {
    console.error("OpenAI error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Unknown error" }),
    };
  }
}
