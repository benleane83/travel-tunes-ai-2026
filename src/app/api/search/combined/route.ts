import { NextRequest, NextResponse } from 'next/server';
import { ExtractedPreferences, FlightOffer, HotelOffer, defaultPreferences } from '@/lib/types';

// Amadeus API configuration
const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY;
const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET;
const AMADEUS_BASE_URL = process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com';

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAmadeusToken(): Promise<string> {
  const now = Date.now();
  
  if (accessToken && tokenExpiry > now + 60000) {
    return accessToken;
  }

  if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
    throw new Error('Amadeus API credentials not configured');
  }

  const response = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: AMADEUS_API_KEY,
      client_secret: AMADEUS_API_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with Amadeus API');
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = now + (data.expires_in * 1000);
  
  return accessToken!;
}

interface SearchRequest {
  originCode: string;
  destinationCode: string;
  departureDate: string;
  returnDate: string;
  preferences: ExtractedPreferences;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { originCode, destinationCode, departureDate, returnDate, preferences } = body;

    // Validate required fields
    if (!originCode || !destinationCode || !departureDate || !returnDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const validPreferences = preferences || defaultPreferences;

    // Check if Amadeus credentials are configured
    if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
      // Return mock data for development
      return NextResponse.json({
        flights: getMockFlights(originCode, destinationCode, departureDate, returnDate, validPreferences),
        hotels: getMockHotels(destinationCode, departureDate, returnDate, validPreferences),
        preferences: validPreferences,
      });
    }

    // Execute parallel API calls for flights and hotels
    const [flightsResult, hotelsResult] = await Promise.allSettled([
      searchFlights(originCode, destinationCode, departureDate, returnDate, validPreferences),
      searchHotels(destinationCode, departureDate, returnDate, validPreferences),
    ]);

    const flights = flightsResult.status === 'fulfilled' ? flightsResult.value : [];
    const hotels = hotelsResult.status === 'fulfilled' ? hotelsResult.value : [];

    const errors: { flights?: string; hotels?: string } = {};
    if (flightsResult.status === 'rejected') {
      errors.flights = 'Failed to search flights';
      console.error('Flight search error:', flightsResult.reason);
    }
    if (hotelsResult.status === 'rejected') {
      errors.hotels = 'Failed to search hotels';
      console.error('Hotel search error:', hotelsResult.reason);
    }

    // If both failed, return mock data
    if (flights.length === 0 && hotels.length === 0) {
      return NextResponse.json({
        flights: getMockFlights(originCode, destinationCode, departureDate, returnDate, validPreferences),
        hotels: getMockHotels(destinationCode, departureDate, returnDate, validPreferences),
        preferences: validPreferences,
        errors,
      });
    }

    return NextResponse.json({
      flights: flights.length > 0 ? flights : getMockFlights(originCode, destinationCode, departureDate, returnDate, validPreferences),
      hotels: hotels.length > 0 ? hotels : getMockHotels(destinationCode, departureDate, returnDate, validPreferences),
      preferences: validPreferences,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in combined search:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

async function searchFlights(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  preferences: ExtractedPreferences
): Promise<FlightOffer[]> {
  const token = await getAmadeusToken();

  const searchParams = new URLSearchParams({
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate: departureDate,
    returnDate: returnDate,
    adults: '1',
    travelClass: preferences.cabinClass,
    max: '10',
    currencyCode: 'USD',
  });

  const response = await fetch(
    `${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${searchParams}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Flight search API error:', errorData);
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

async function searchHotels(
  cityCode: string,
  checkInDate: string,
  checkOutDate: string,
  preferences: ExtractedPreferences
): Promise<HotelOffer[]> {
  const token = await getAmadeusToken();

  // First, get hotel list for the city
  const hotelListParams = new URLSearchParams({
    cityCode: cityCode,
    radius: '30',
    radiusUnit: 'KM',
    ratings: String(preferences.hotelStars),
    hotelSource: 'ALL',
  });

  const hotelListResponse = await fetch(
    `${AMADEUS_BASE_URL}/v1/reference-data/locations/hotels/by-city?${hotelListParams}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!hotelListResponse.ok) {
    console.error('Hotel list API error:', await hotelListResponse.text());
    return [];
  }

  const hotelListData = await hotelListResponse.json();
  const hotelIds = (hotelListData.data || [])
    .slice(0, 10)
    .map((h: { hotelId: string }) => h.hotelId);

  if (hotelIds.length === 0) {
    return [];
  }

  // Then, get offers for those hotels
  const offersParams = new URLSearchParams({
    hotelIds: hotelIds.join(','),
    checkInDate: checkInDate,
    checkOutDate: checkOutDate,
    adults: '1',
    currency: 'USD',
  });

  const offersResponse = await fetch(
    `${AMADEUS_BASE_URL}/v3/shopping/hotel-offers?${offersParams}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!offersResponse.ok) {
    console.error('Hotel offers API error:', await offersResponse.text());
    return [];
  }

  const offersData = await offersResponse.json();
  return offersData.data || [];
}

// Mock data generators for development
function getMockFlights(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  preferences: ExtractedPreferences
): FlightOffer[] {
  const basePrices: Record<ExtractedPreferences['cabinClass'], number> = {
    'ECONOMY': 300,
    'PREMIUM_ECONOMY': 500,
    'BUSINESS': 1200,
    'FIRST': 3000,
  };

  const basePrice = basePrices[preferences.cabinClass];
  const airlines = ['AA', 'UA', 'DL', 'BA', 'AF', 'LH'];

  return Array.from({ length: 5 }, (_, i) => {
    const price = basePrice + (i * 50) + Math.floor(Math.random() * 100);
    const airline = airlines[i % airlines.length];
    
    return {
      id: `flight-${i + 1}`,
      price: {
        total: price.toFixed(2),
        currency: 'USD',
      },
      itineraries: [
        {
          duration: `PT${8 + i}H${30 + (i * 10)}M`,
          segments: [
            {
              departure: {
                iataCode: origin,
                at: `${departureDate}T${String(8 + i).padStart(2, '0')}:00:00`,
              },
              arrival: {
                iataCode: destination,
                at: `${departureDate}T${String(16 + i).padStart(2, '0')}:30:00`,
              },
              carrierCode: airline,
              flightNumber: `${1000 + i}`,
              duration: `PT${8 + i}H30M`,
            },
          ],
        },
        {
          duration: `PT${9 + i}H15M`,
          segments: [
            {
              departure: {
                iataCode: destination,
                at: `${returnDate}T${String(9 + i).padStart(2, '0')}:00:00`,
              },
              arrival: {
                iataCode: origin,
                at: `${returnDate}T${String(18 + i).padStart(2, '0')}:15:00`,
              },
              carrierCode: airline,
              flightNumber: `${2000 + i}`,
              duration: `PT${9 + i}H15M`,
            },
          ],
        },
      ],
      travelerPricings: [
        {
          travelerId: '1',
          fareOption: 'STANDARD',
          travelerType: 'ADULT',
          price: {
            total: price.toFixed(2),
            currency: 'USD',
          },
          fareDetailsBySegment: [
            {
              segmentId: '1',
              cabin: preferences.cabinClass,
              fareBasis: 'YOWUS',
              class: 'Y',
            },
          ],
        },
      ],
    };
  });
}

function getMockHotels(
  cityCode: string,
  checkInDate: string,
  checkOutDate: string,
  preferences: ExtractedPreferences
): HotelOffer[] {
  const hotelNames = [
    'Grand Plaza Hotel',
    'City Center Inn',
    'Skyline Suites',
    'Harbor View Hotel',
    'Metropolitan Lodge',
  ];

  const basePrices: Record<number, number> = {
    1: 50,
    2: 80,
    3: 120,
    4: 200,
    5: 350,
  };

  const basePrice = basePrices[preferences.hotelStars] || 120;

  return hotelNames.map((name, i) => {
    const price = basePrice + (i * 30) + Math.floor(Math.random() * 50);
    const nights = Math.max(1, Math.ceil(
      (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
    ));
    
    return {
      hotel: {
        hotelId: `hotel-${cityCode}-${i + 1}`,
        name: name,
        rating: String(preferences.hotelStars),
        address: {
          lines: [`${100 + i} Main Street`],
          cityName: cityCode,
        },
      },
      offers: [
        {
          id: `offer-${i + 1}`,
          checkInDate: checkInDate,
          checkOutDate: checkOutDate,
          price: {
            total: (price * nights).toFixed(2),
            currency: 'USD',
          },
          room: {
            description: {
              text: `Standard ${preferences.hotelStars}-star room with all amenities`,
            },
          },
        },
      ],
    };
  });
}
