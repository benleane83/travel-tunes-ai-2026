import { NextRequest, NextResponse } from 'next/server';

// Amadeus API credentials would be stored in environment variables
const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY;
const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET;
const AMADEUS_BASE_URL = process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com';

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAmadeusToken(): Promise<string> {
  const now = Date.now();
  
  // Return cached token if still valid (with 60s buffer)
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get('keyword');

  if (!keyword || keyword.length < 2) {
    return NextResponse.json(
      { error: 'Keyword must be at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    // Check if Amadeus credentials are configured
    if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
      // Return mock data for development
      return NextResponse.json({
        locations: getMockLocations(keyword),
      });
    }

    const token = await getAmadeusToken();

    const response = await fetch(
      `${AMADEUS_BASE_URL}/v1/reference-data/locations?` +
      new URLSearchParams({
        subType: 'CITY,AIRPORT',
        keyword: keyword,
        'page[limit]': '10',
        sort: 'analytics.travelers.score',
        view: 'LIGHT',
      }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Amadeus API error:', errorData);
      
      // Return mock data on API errors
      return NextResponse.json({
        locations: getMockLocations(keyword),
      });
    }

    const data = await response.json();

    const locations = (data.data || []).map((item: {
      iataCode: string;
      name: string;
      address?: {
        cityName?: string;
        countryName?: string;
      };
      subType: string;
    }) => ({
      iataCode: item.iataCode,
      name: item.name,
      cityName: item.address?.cityName || item.name,
      countryName: item.address?.countryName || '',
      subType: item.subType,
    }));

    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Error searching locations:', error);
    
    // Return mock data on errors
    return NextResponse.json({
      locations: getMockLocations(keyword),
    });
  }
}

// Mock data for development/testing
function getMockLocations(keyword: string) {
  const allLocations = [
    { iataCode: 'JFK', name: 'John F. Kennedy International Airport', cityName: 'New York', countryName: 'United States', subType: 'AIRPORT' },
    { iataCode: 'LGA', name: 'LaGuardia Airport', cityName: 'New York', countryName: 'United States', subType: 'AIRPORT' },
    { iataCode: 'EWR', name: 'Newark Liberty International Airport', cityName: 'Newark', countryName: 'United States', subType: 'AIRPORT' },
    { iataCode: 'LAX', name: 'Los Angeles International Airport', cityName: 'Los Angeles', countryName: 'United States', subType: 'AIRPORT' },
    { iataCode: 'LHR', name: 'London Heathrow Airport', cityName: 'London', countryName: 'United Kingdom', subType: 'AIRPORT' },
    { iataCode: 'LGW', name: 'London Gatwick Airport', cityName: 'London', countryName: 'United Kingdom', subType: 'AIRPORT' },
    { iataCode: 'CDG', name: 'Charles de Gaulle Airport', cityName: 'Paris', countryName: 'France', subType: 'AIRPORT' },
    { iataCode: 'ORY', name: 'Paris Orly Airport', cityName: 'Paris', countryName: 'France', subType: 'AIRPORT' },
    { iataCode: 'DXB', name: 'Dubai International Airport', cityName: 'Dubai', countryName: 'United Arab Emirates', subType: 'AIRPORT' },
    { iataCode: 'SIN', name: 'Singapore Changi Airport', cityName: 'Singapore', countryName: 'Singapore', subType: 'AIRPORT' },
    { iataCode: 'HND', name: 'Tokyo Haneda Airport', cityName: 'Tokyo', countryName: 'Japan', subType: 'AIRPORT' },
    { iataCode: 'NRT', name: 'Narita International Airport', cityName: 'Tokyo', countryName: 'Japan', subType: 'AIRPORT' },
    { iataCode: 'SYD', name: 'Sydney Kingsford Smith Airport', cityName: 'Sydney', countryName: 'Australia', subType: 'AIRPORT' },
    { iataCode: 'ORD', name: "O'Hare International Airport", cityName: 'Chicago', countryName: 'United States', subType: 'AIRPORT' },
    { iataCode: 'SFO', name: 'San Francisco International Airport', cityName: 'San Francisco', countryName: 'United States', subType: 'AIRPORT' },
    { iataCode: 'MIA', name: 'Miami International Airport', cityName: 'Miami', countryName: 'United States', subType: 'AIRPORT' },
    { iataCode: 'BOS', name: 'Boston Logan International Airport', cityName: 'Boston', countryName: 'United States', subType: 'AIRPORT' },
    { iataCode: 'SEA', name: 'Seattle-Tacoma International Airport', cityName: 'Seattle', countryName: 'United States', subType: 'AIRPORT' },
    { iataCode: 'DEN', name: 'Denver International Airport', cityName: 'Denver', countryName: 'United States', subType: 'AIRPORT' },
    { iataCode: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', cityName: 'Atlanta', countryName: 'United States', subType: 'AIRPORT' },
  ];

  const lowerKeyword = keyword.toLowerCase();
  return allLocations.filter(
    (loc) =>
      loc.cityName.toLowerCase().includes(lowerKeyword) ||
      loc.name.toLowerCase().includes(lowerKeyword) ||
      loc.iataCode.toLowerCase().includes(lowerKeyword)
  );
}
