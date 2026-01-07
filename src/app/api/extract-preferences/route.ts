import { NextRequest, NextResponse } from 'next/server';
import { ExtractedPreferences, defaultPreferences } from '@/lib/types';

// Azure OpenAI (Microsoft Foundry) configuration
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

const extractionPrompt = `You are a travel preference extraction assistant. Analyze the user's natural language travel preferences and extract the following structured information:

1. cabinClass: One of "ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", or "FIRST"
2. budgetLevel: One of "budget", "moderate", or "luxury"
3. hotelStars: A number from 1 to 5
4. flightTimePreference: One of "morning", "afternoon", "evening", or "any"
5. airlinePreference: One of "budget", "premium", or "any"

Guidelines:
- "morning" flights are typically before 12:00 PM
- "afternoon" flights are typically 12:00 PM - 6:00 PM
- "evening" flights are typically after 6:00 PM
- "budget" airlines include low-cost carriers like Southwest, Spirit, Ryanair
- "premium" airlines include full-service carriers like Delta, United, British Airways, Emirates
- If the user doesn't specify a preference, use "any" or the moderate/default option
- Business or first class typically implies luxury budget level
- Economy typically implies budget or moderate budget level

Respond ONLY with a valid JSON object containing these 5 fields. Do not include any explanation or additional text.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { preferences: userPreferences } = body;

    // If no preferences provided, return defaults
    if (!userPreferences || userPreferences.trim() === '') {
      return NextResponse.json({
        preferences: defaultPreferences,
        rawText: '',
        success: true,
      });
    }

    // Check if Azure OpenAI is configured
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      // Use keyword-based extraction as fallback
      const extracted = extractPreferencesFromKeywords(userPreferences);
      return NextResponse.json({
        preferences: extracted,
        rawText: userPreferences,
        success: true,
      });
    }

    try {
      const response = await fetch(
        `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: extractionPrompt },
              { role: 'user', content: userPreferences },
            ],
            temperature: 0.3,
            max_tokens: 200,
            response_format: { type: 'json_object' },
          }),
        }
      );

      if (!response.ok) {
        console.error('Azure OpenAI API error:', await response.text());
        // Fallback to keyword extraction
        const extracted = extractPreferencesFromKeywords(userPreferences);
        return NextResponse.json({
          preferences: extracted,
          rawText: userPreferences,
          success: true,
        });
      }

      const data = await response.json();
      const extractedText = data.choices?.[0]?.message?.content || '{}';
      
      let parsedPreferences: Partial<ExtractedPreferences>;
      try {
        parsedPreferences = JSON.parse(extractedText);
      } catch {
        parsedPreferences = {};
      }

      // Validate and merge with defaults
      const preferences: ExtractedPreferences = {
        cabinClass: validateCabinClass(parsedPreferences.cabinClass),
        budgetLevel: validateBudgetLevel(parsedPreferences.budgetLevel),
        hotelStars: validateHotelStars(parsedPreferences.hotelStars),
        flightTimePreference: validateFlightTime(parsedPreferences.flightTimePreference),
        airlinePreference: validateAirlinePreference(parsedPreferences.airlinePreference),
      };

      return NextResponse.json({
        preferences,
        rawText: userPreferences,
        success: true,
      });
    } catch (apiError) {
      console.error('Error calling Azure OpenAI:', apiError);
      // Fallback to keyword extraction
      const extracted = extractPreferencesFromKeywords(userPreferences);
      return NextResponse.json({
        preferences: extracted,
        rawText: userPreferences,
        success: true,
      });
    }
  } catch (error) {
    console.error('Error extracting preferences:', error);
    return NextResponse.json({
      preferences: defaultPreferences,
      rawText: '',
      success: false,
      error: 'Failed to extract preferences',
    });
  }
}

// Validation helpers
function validateCabinClass(value: unknown): ExtractedPreferences['cabinClass'] {
  const valid = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];
  return valid.includes(value as string) 
    ? (value as ExtractedPreferences['cabinClass']) 
    : defaultPreferences.cabinClass;
}

function validateBudgetLevel(value: unknown): ExtractedPreferences['budgetLevel'] {
  const valid = ['budget', 'moderate', 'luxury'];
  return valid.includes(value as string) 
    ? (value as ExtractedPreferences['budgetLevel']) 
    : defaultPreferences.budgetLevel;
}

function validateHotelStars(value: unknown): number {
  const num = Number(value);
  return num >= 1 && num <= 5 ? Math.round(num) : defaultPreferences.hotelStars;
}

function validateFlightTime(value: unknown): ExtractedPreferences['flightTimePreference'] {
  const valid = ['morning', 'afternoon', 'evening', 'any'];
  return valid.includes(value as string) 
    ? (value as ExtractedPreferences['flightTimePreference']) 
    : defaultPreferences.flightTimePreference;
}

function validateAirlinePreference(value: unknown): ExtractedPreferences['airlinePreference'] {
  const valid = ['budget', 'premium', 'any'];
  return valid.includes(value as string) 
    ? (value as ExtractedPreferences['airlinePreference']) 
    : defaultPreferences.airlinePreference;
}

// Keyword-based extraction fallback
function extractPreferencesFromKeywords(text: string): ExtractedPreferences {
  const lower = text.toLowerCase();
  
  // Cabin class
  let cabinClass: ExtractedPreferences['cabinClass'] = 'ECONOMY';
  if (lower.includes('first class') || lower.includes('first-class')) {
    cabinClass = 'FIRST';
  } else if (lower.includes('business class') || lower.includes('business-class')) {
    cabinClass = 'BUSINESS';
  } else if (lower.includes('premium economy') || lower.includes('premium-economy')) {
    cabinClass = 'PREMIUM_ECONOMY';
  }

  // Budget level
  let budgetLevel: ExtractedPreferences['budgetLevel'] = 'moderate';
  if (lower.includes('luxury') || lower.includes('premium') || lower.includes('expensive') || lower.includes('high-end')) {
    budgetLevel = 'luxury';
  } else if (lower.includes('budget') || lower.includes('cheap') || lower.includes('affordable') || lower.includes('low-cost')) {
    budgetLevel = 'budget';
  }

  // Hotel stars
  let hotelStars = 3;
  const starMatch = lower.match(/(\d)\s*star/);
  if (starMatch) {
    const stars = parseInt(starMatch[1]);
    if (stars >= 1 && stars <= 5) {
      hotelStars = stars;
    }
  } else if (budgetLevel === 'luxury') {
    hotelStars = 5;
  } else if (budgetLevel === 'budget') {
    hotelStars = 2;
  }

  // Flight time preference
  let flightTimePreference: ExtractedPreferences['flightTimePreference'] = 'any';
  if (lower.includes('morning') || lower.includes('early')) {
    flightTimePreference = 'morning';
  } else if (lower.includes('afternoon') || lower.includes('midday')) {
    flightTimePreference = 'afternoon';
  } else if (lower.includes('evening') || lower.includes('night') || lower.includes('late')) {
    flightTimePreference = 'evening';
  }

  // Airline preference
  let airlinePreference: ExtractedPreferences['airlinePreference'] = 'any';
  if (lower.includes('budget airline') || lower.includes('low-cost carrier') || lower.includes('cheap airline')) {
    airlinePreference = 'budget';
  } else if (lower.includes('premium airline') || lower.includes('full-service') || lower.includes('major airline')) {
    airlinePreference = 'premium';
  }

  return {
    cabinClass,
    budgetLevel,
    hotelStars,
    flightTimePreference,
    airlinePreference,
  };
}
