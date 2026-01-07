import { z } from 'zod';

// City/Airport type
export interface City {
  name: string;
  iataCode: string;
}

// Form validation schema
export const travelPlannerSchema = z.object({
  originCity: z.object({
    name: z.string().min(1, 'Origin city is required'),
    iataCode: z.string().min(3, 'Invalid IATA code').max(3),
  }),
  destinationCity: z.object({
    name: z.string().min(1, 'Destination city is required'),
    iataCode: z.string().min(3, 'Invalid IATA code').max(3),
  }),
  departureDate: z.date({ error: 'Departure date is required' }),
  returnDate: z.date({ error: 'Return date is required' }),
  preferences: z.string().optional(),
}).refine((data) => data.returnDate > data.departureDate, {
  message: 'Return date must be after departure date',
  path: ['returnDate'],
});

export type TravelPlannerFormData = z.infer<typeof travelPlannerSchema>;

// Extracted preferences from LLM
export interface ExtractedPreferences {
  cabinClass: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  budgetLevel: 'budget' | 'moderate' | 'luxury';
  hotelStars: number;
  flightTimePreference: 'morning' | 'afternoon' | 'evening' | 'any';
  airlinePreference: 'budget' | 'premium' | 'any';
}

// Default preferences
export const defaultPreferences: ExtractedPreferences = {
  cabinClass: 'ECONOMY',
  budgetLevel: 'moderate',
  hotelStars: 3,
  flightTimePreference: 'any',
  airlinePreference: 'any',
};

// Flight offer from Amadeus API
export interface FlightOffer {
  id: string;
  price: {
    total: string;
    currency: string;
  };
  itineraries: {
    duration: string;
    segments: {
      departure: {
        iataCode: string;
        at: string;
      };
      arrival: {
        iataCode: string;
        at: string;
      };
      carrierCode: string;
      flightNumber: string;
      duration: string;
    }[];
  }[];
  travelerPricings?: {
    travelerId: string;
    fareOption: string;
    travelerType: string;
    price: {
      total: string;
      currency: string;
    };
    fareDetailsBySegment: {
      segmentId: string;
      cabin: string;
      fareBasis: string;
      class: string;
    }[];
  }[];
}

// Hotel offer from Amadeus API
export interface HotelOffer {
  hotel: {
    hotelId: string;
    name: string;
    rating?: string;
    address?: {
      lines?: string[];
      cityName?: string;
    };
  };
  offers: {
    id: string;
    checkInDate: string;
    checkOutDate: string;
    price: {
      total: string;
      currency: string;
    };
    room?: {
      description?: {
        text?: string;
      };
    };
  }[];
}

// Search results
export interface SearchResults {
  flights: FlightOffer[];
  hotels: HotelOffer[];
  preferences: ExtractedPreferences;
  searchCriteria: {
    origin: City;
    destination: City;
    departureDate: string;
    returnDate: string;
  };
  timestamp: string;
}

// Saved itinerary for localStorage
export interface SavedItinerary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  formData: {
    originCity: City;
    destinationCity: City;
    departureDate: string;
    returnDate: string;
    preferences: string;
  };
  results?: SearchResults;
  isDraft: boolean;
}

// API response types
export interface LocationSearchResponse {
  data: {
    iataCode: string;
    name: string;
    address: {
      cityName: string;
      countryName: string;
    };
    subType: string;
  }[];
}

export interface ExtractPreferencesResponse {
  preferences: ExtractedPreferences;
  rawText: string;
  success: boolean;
}

export interface CombinedSearchResponse {
  flights: FlightOffer[];
  hotels: HotelOffer[];
  preferences: ExtractedPreferences;
  errors?: {
    flights?: string;
    hotels?: string;
  };
}
