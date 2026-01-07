"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { Plane, Building2, Clock, Star, Calendar, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchResults, FlightOffer, HotelOffer, ExtractedPreferences } from "@/lib/types"

interface ResultsDisplayProps {
  results: SearchResults | null
  loading?: boolean
}

export function ResultsDisplay({ results, loading }: ResultsDisplayProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!results) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Extracted Preferences Summary */}
      <PreferencesSummary preferences={results.preferences} />

      {/* Search Criteria */}
      <SearchCriteriaSummary criteria={results.searchCriteria} />

      {/* Flights Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Plane className="h-6 w-6" />
          Flight Options ({results.flights.length})
        </h2>
        {results.flights.length === 0 ? (
          <p className="text-muted-foreground">No flights found matching your criteria.</p>
        ) : (
          <div className="grid gap-4">
            {results.flights.map((flight, index) => (
              <FlightCard key={flight.id || index} flight={flight} />
            ))}
          </div>
        )}
      </section>

      {/* Hotels Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Hotel Options ({results.hotels.length})
        </h2>
        {results.hotels.length === 0 ? (
          <p className="text-muted-foreground">No hotels found matching your criteria.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {results.hotels.map((hotel, index) => (
              <HotelCard key={hotel.hotel.hotelId || index} hotel={hotel} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PreferencesSummary({ preferences }: { preferences: ExtractedPreferences }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Extracted Preferences</CardTitle>
        <CardDescription>Based on your natural language input</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Cabin Class</span>
            <p className="font-medium">{formatCabinClass(preferences.cabinClass)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Budget Level</span>
            <p className="font-medium capitalize">{preferences.budgetLevel}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Hotel Rating</span>
            <p className="font-medium flex items-center gap-1">
              {preferences.hotelStars} <Star className="h-3 w-3 fill-current" />
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Flight Time</span>
            <p className="font-medium capitalize">{preferences.flightTimePreference}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Airline Pref.</span>
            <p className="font-medium capitalize">{preferences.airlinePreference}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SearchCriteriaSummary({ criteria }: { criteria: SearchResults['searchCriteria'] }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-center gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{criteria.origin.iataCode}</p>
            <p className="text-sm text-muted-foreground">{criteria.origin.name}</p>
          </div>
          <ArrowRight className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{criteria.destination.iataCode}</p>
            <p className="text-sm text-muted-foreground">{criteria.destination.name}</p>
          </div>
          <div className="ml-8 flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            <span>
              {format(parseISO(criteria.departureDate), 'MMM d')} - {format(parseISO(criteria.returnDate), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FlightCard({ flight }: { flight: FlightOffer }) {
  const outbound = flight.itineraries[0]
  const returnFlight = flight.itineraries[1]
  const cabin = flight.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || 'ECONOMY'

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Price */}
          <div className="text-center md:text-left md:w-32">
            <p className="text-3xl font-bold text-primary">
              ${parseFloat(flight.price.total).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{flight.price.currency}</p>
            <p className="text-xs text-muted-foreground">{formatCabinClass(cabin as ExtractedPreferences['cabinClass'])}</p>
          </div>

          {/* Flight Details */}
          <div className="flex-1 space-y-3">
            {/* Outbound */}
            <FlightSegmentDisplay 
              segment={outbound?.segments[0]} 
              duration={outbound?.duration}
              label="Outbound"
            />
            
            {/* Return */}
            {returnFlight && (
              <FlightSegmentDisplay 
                segment={returnFlight.segments[0]} 
                duration={returnFlight.duration}
                label="Return"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FlightSegmentDisplay({ 
  segment, 
  duration,
  label 
}: { 
  segment?: FlightOffer['itineraries'][0]['segments'][0]
  duration?: string
  label: string
}) {
  if (!segment) return null

  const departureTime = segment.departure.at ? format(parseISO(segment.departure.at), 'HH:mm') : '--:--'
  const arrivalTime = segment.arrival.at ? format(parseISO(segment.arrival.at), 'HH:mm') : '--:--'

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-xs text-muted-foreground w-16">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono font-medium">{departureTime}</span>
        <span className="text-muted-foreground">{segment.departure.iataCode}</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 border-t border-dashed" />
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(duration)}
        </span>
        <div className="flex-1 border-t border-dashed" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{segment.arrival.iataCode}</span>
        <span className="font-mono font-medium">{arrivalTime}</span>
      </div>
      <span className="text-xs text-muted-foreground">
        {segment.carrierCode} {segment.flightNumber}
      </span>
    </div>
  )
}

function HotelCard({ hotel }: { hotel: HotelOffer }) {
  const offer = hotel.offers[0]
  if (!offer) return null

  const rating = parseInt(hotel.hotel.rating || '3')

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{hotel.hotel.name}</h3>
              <div className="flex items-center gap-1 text-yellow-500">
                {Array.from({ length: rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                ${parseFloat(offer.price.total).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">total stay</p>
            </div>
          </div>

          {hotel.hotel.address?.lines && (
            <p className="text-sm text-muted-foreground">
              {hotel.hotel.address.lines.join(', ')}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(parseISO(offer.checkInDate), 'MMM d')} - {format(parseISO(offer.checkOutDate), 'MMM d')}
            </span>
          </div>

          {offer.room?.description?.text && (
            <p className="text-sm text-muted-foreground">{offer.room.description.text}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Helper functions
function formatCabinClass(cabin: string): string {
  const mapping: Record<string, string> = {
    'ECONOMY': 'Economy',
    'PREMIUM_ECONOMY': 'Premium Economy',
    'BUSINESS': 'Business',
    'FIRST': 'First Class',
  }
  return mapping[cabin] || cabin
}

function formatDuration(duration?: string): string {
  if (!duration) return '--'
  // Parse ISO 8601 duration (e.g., PT8H30M)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return duration
  const hours = match[1] || '0'
  const minutes = match[2] || '0'
  return `${hours}h ${minutes}m`
}
