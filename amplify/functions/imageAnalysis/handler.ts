// amplify/functions/imageAnalysis/handler.ts
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
  needsDetailedAnalysis?: boolean;
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
    const isMealDetailed = args?.includes('meal photo') || false;
    const isWeightDetailed = args?.includes('weight measurement') || false;

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
    } else if (isMealDetailed) {
      // Detailed analysis for meal photos
      promptText = `This is a meal photo. Please carefully analyze the food items and estimate calories.
      ${args ? `The user describes this as: "${args.replace('This is a meal photo. Please carefully analyze the food items and estimate calories if possible.', '')}"` : ''}
      
      Pay attention to food items and portion sizes. Provide a detailed analysis in JSON format with the following:
      
      1. The name of the meal (e.g., "Grilled Chicken Salad", "Protein Breakfast")
      2. List of visible food items
      3. Estimated total calories based on portion size and components
      4. A brief content suggestion for the user's post
      
      Return ONLY a JSON object matching this structure:
      {
        "type": "meal",
        "suggestedData": {
          "content": "string",
          "meal": { 
            "name": "string", 
            "foods": ["string"], 
            "calories": number  // MUST be a number, estimate if unsure
          }
        }
      }
      
      EXAMPLE of good output:
      {
        "type": "meal",
        "suggestedData": {
          "content": "Healthy lunch to fuel my workout today!",
          "meal": { 
            "name": "Protein-packed lunch", 
            "foods": ["grilled chicken breast", "quinoa", "roasted vegetables", "avocado"], 
            "calories": 550
          }
        }
      }`;
    } else if (isWeightDetailed) {
      // Detailed analysis for weight photos with emphasis on digital scales
      promptText = `This is a weight tracking photo. Your ONLY task is to read the weight value shown on the scale display.

          CRITICAL INSTRUCTIONS:
          - This is likely a digital bathroom scale with an LCD or LED display
          - Look carefully for numbers displayed on a screen or digital readout
          - Find and extract ONLY the numeric weight value (e.g., 170.2, 185.6, 73.5)
          - Identify if the unit is pounds (lbs) or kilograms (kg)
          - Return EXACTLY the number shown, including decimal places
          
          IMPORTANT: Do not interpret, round, or convert the weight - report exactly what you see.
          
          Return ONLY a JSON object with this structure:
          {
            "type": "weight",
            "suggestedData": {
              "content": "Weight check: NUMBER lbs/kg",
              "weight": { 
                "value": 170.2,  // MUST be the exact numeric value you see
                "unit": "lbs"    // or "kg", based on what's shown
              }
            }
          }
          
          Examples of digital scale readings:
          - If you see "170.2 lb" on display → value: 170.2, unit: "lbs"
          - If you see "77.5 kg" on display → value: 77.5, unit: "kg"
          - If you see just "165" without decimals → value: 165, unit: "lbs" (or "kg" if indicated)`;
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

      if (parsedResult.type === 'weight') {
        console.log('Weight data validation check:', {
          hasWeightData: !!parsedResult.suggestedData.weight,
          weightValue: parsedResult.suggestedData.weight?.value,
          weightValueType: typeof parsedResult.suggestedData.weight?.value,
          content: parsedResult.suggestedData.content
        });
        
        // If weight data is missing but we have content, try to extract weight from content
        if ((!parsedResult.suggestedData.weight || !parsedResult.suggestedData.weight.value) && 
            parsedResult.suggestedData.content) {
          
          console.log('Attempting to extract weight from content:', parsedResult.suggestedData.content);
          
          // Look for patterns like "170.2 lbs" or "weight: 170.2"
          const weightRegex = /(\d+\.\d+|\d+)\s*(lbs?|pounds?|kgs?|kilograms?)/i;
          const match = parsedResult.suggestedData.content.match(weightRegex);
          
          if (match) {
            const extractedValue = parseFloat(match[1]);
            const extractedUnit = match[2].toLowerCase().startsWith('lb') || 
                                match[2].toLowerCase().startsWith('pound') ? 'lbs' : 'kg';
            
            console.log(`Extracted weight from content: ${extractedValue} ${extractedUnit}`);
            
            if (!parsedResult.suggestedData.weight) {
              parsedResult.suggestedData.weight = {
                value: extractedValue,
                unit: extractedUnit
              };
            } else {
              parsedResult.suggestedData.weight.value = extractedValue;
              parsedResult.suggestedData.weight.unit = extractedUnit;
            }
          }
        }
        
        // Ensure weight value is numeric
        if (parsedResult.suggestedData.weight && typeof parsedResult.suggestedData.weight.value === 'string') {
          // Try to convert string to number
          const numericValue = parseFloat(parsedResult.suggestedData.weight.value);
          if (!isNaN(numericValue)) {
            console.log('Converting string weight value to number:', parsedResult.suggestedData.weight.value, '->', numericValue);
            parsedResult.suggestedData.weight.value = numericValue;
          }
        }
      }


      // Specific validation for meal data
      if (parsedResult.type === 'meal') {
        console.log('Meal data validation check:', {
          hasMealData: !!parsedResult.suggestedData.meal,
          mealName: parsedResult.suggestedData.meal?.name,
          caloriesValue: parsedResult.suggestedData.meal?.calories,
          caloriesType: typeof parsedResult.suggestedData.meal?.calories
        });

        // Ensure meal has proper structure
        if (!parsedResult.suggestedData.meal) {
          parsedResult.suggestedData.meal = {
            name: 'Meal',
            foods: [],
            calories: 0
          };
        }

        // Ensure calories is numeric
        if (parsedResult.suggestedData.meal && typeof parsedResult.suggestedData.meal.calories === 'string') {
          // Try to convert string to number if possible
          const numericCalories = parseFloat(parsedResult.suggestedData.meal.calories);
          if (!isNaN(numericCalories)) {
            console.log('Converting string calories value to number:', parsedResult.suggestedData.meal.calories, '->', numericCalories);
            parsedResult.suggestedData.meal.calories = numericCalories;
          } else {
            // Set a default if we couldn't parse
            parsedResult.suggestedData.meal.calories = 0;
          }
        }

        // Ensure foods array exists
        if (!parsedResult.suggestedData.meal.foods) {
          parsedResult.suggestedData.meal.foods = [];
        }

        // Ensure meal name exists
        if (!parsedResult.suggestedData.meal.name) {
          parsedResult.suggestedData.meal.name = 'Meal';
        }

        
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