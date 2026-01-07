"use client"

import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Search, Save, Download, History } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CityAutocomplete } from "@/components/CityAutocomplete"
import { DatePicker } from "@/components/DatePicker"
import { PreferencesTextarea } from "@/components/PreferencesTextarea"
import { ResultsDisplay } from "@/components/ResultsDisplay"
import {
  travelPlannerSchema,
  TravelPlannerFormData,
  City,
  SearchResults,
  ExtractedPreferences,
  SavedItinerary,
} from "@/lib/types"
import {
  saveDraft,
  loadDraft,
  clearDraft,
  saveItinerary,
  getRecentItineraries,
  DraftFormData,
} from "@/lib/storage"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function TravelPlannerForm() {
  const [isSearching, setIsSearching] = React.useState(false)
  const [results, setResults] = React.useState<SearchResults | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [recentItineraries, setRecentItineraries] = React.useState<SavedItinerary[]>([])
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false)
  const [itineraryName, setItineraryName] = React.useState("")

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TravelPlannerFormData>({
    resolver: zodResolver(travelPlannerSchema),
    mode: "onChange",
    defaultValues: {
      originCity: undefined,
      destinationCity: undefined,
      departureDate: undefined,
      returnDate: undefined,
      preferences: "",
    },
  })

  const formValues = watch()

  // Load draft on mount
  React.useEffect(() => {
    const draft = loadDraft()
    if (draft) {
      if (draft.originCity) {
        setValue("originCity", draft.originCity as City)
      }
      if (draft.destinationCity) {
        setValue("destinationCity", draft.destinationCity as City)
      }
      if (draft.departureDate) {
        setValue("departureDate", new Date(draft.departureDate))
      }
      if (draft.returnDate) {
        setValue("returnDate", new Date(draft.returnDate))
      }
      if (draft.preferences) {
        setValue("preferences", draft.preferences)
      }
    }

    // Load recent itineraries
    setRecentItineraries(getRecentItineraries(5))
  }, [setValue])

  // Auto-save draft on form changes
  React.useEffect(() => {
    const draftData: DraftFormData = {
      originCity: formValues.originCity || null,
      destinationCity: formValues.destinationCity || null,
      departureDate: formValues.departureDate?.toISOString() || null,
      returnDate: formValues.returnDate?.toISOString() || null,
      preferences: formValues.preferences || "",
    }
    saveDraft(draftData)
  }, [formValues])

  const onSubmit = async (data: TravelPlannerFormData) => {
    setIsSearching(true)
    setError(null)
    setResults(null)

    try {
      // Step 1: Extract preferences using LLM
      let extractedPreferences: ExtractedPreferences

      if (data.preferences && data.preferences.trim()) {
        const prefResponse = await fetch("/api/extract-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences: data.preferences }),
        })

        if (!prefResponse.ok) {
          throw new Error("Failed to extract preferences")
        }

        const prefData = await prefResponse.json()
        extractedPreferences = prefData.preferences
      } else {
        // Use defaults if no preferences provided
        extractedPreferences = {
          cabinClass: "ECONOMY",
          budgetLevel: "moderate",
          hotelStars: 3,
          flightTimePreference: "any",
          airlinePreference: "any",
        }
      }

      // Step 2: Search for flights and hotels
      const searchResponse = await fetch("/api/search/combined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originCode: data.originCity.iataCode,
          destinationCode: data.destinationCity.iataCode,
          departureDate: format(data.departureDate, "yyyy-MM-dd"),
          returnDate: format(data.returnDate, "yyyy-MM-dd"),
          preferences: extractedPreferences,
        }),
      })

      if (!searchResponse.ok) {
        throw new Error("Failed to search flights and hotels")
      }

      const searchData = await searchResponse.json()

      const searchResults: SearchResults = {
        flights: searchData.flights || [],
        hotels: searchData.hotels || [],
        preferences: extractedPreferences,
        searchCriteria: {
          origin: data.originCity,
          destination: data.destinationCity,
          departureDate: format(data.departureDate, "yyyy-MM-dd"),
          returnDate: format(data.returnDate, "yyyy-MM-dd"),
        },
        timestamp: new Date().toISOString(),
      }

      setResults(searchResults)
      clearDraft()
    } catch (err) {
      console.error("Search error:", err)
      setError(err instanceof Error ? err.message : "An error occurred during search")
    } finally {
      setIsSearching(false)
    }
  }

  const handleSaveItinerary = () => {
    if (!results || !itineraryName.trim()) return

    const formData = {
      originCity: results.searchCriteria.origin,
      destinationCity: results.searchCriteria.destination,
      departureDate: results.searchCriteria.departureDate,
      returnDate: results.searchCriteria.returnDate,
      preferences: formValues.preferences || "",
    }

    saveItinerary(itineraryName, formData, results)
    setRecentItineraries(getRecentItineraries(5))
    setSaveDialogOpen(false)
    setItineraryName("")
  }

  const handleExportItinerary = () => {
    if (!results) return

    // Create export object directly without saving to storage
    const exportData = {
      id: `export-${Date.now()}`,
      name: `Export-${format(new Date(), "yyyy-MM-dd")}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      formData: {
        originCity: results.searchCriteria.origin,
        destinationCity: results.searchCriteria.destination,
        departureDate: results.searchCriteria.departureDate,
        returnDate: results.searchCriteria.returnDate,
        preferences: formValues.preferences || "",
      },
      results,
      isDraft: false,
    }

    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `itinerary-${format(new Date(), "yyyy-MM-dd")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadItinerary = (itinerary: SavedItinerary) => {
    if (itinerary.formData.originCity) {
      setValue("originCity", itinerary.formData.originCity)
    }
    if (itinerary.formData.destinationCity) {
      setValue("destinationCity", itinerary.formData.destinationCity)
    }
    if (itinerary.formData.departureDate) {
      setValue("departureDate", new Date(itinerary.formData.departureDate))
    }
    if (itinerary.formData.returnDate) {
      setValue("returnDate", new Date(itinerary.formData.returnDate))
    }
    if (itinerary.formData.preferences) {
      setValue("preferences", itinerary.formData.preferences)
    }
    if (itinerary.results) {
      setResults(itinerary.results)
    }
  }

  return (
    <div className="space-y-8">
      {/* Recent Itineraries */}
      {recentItineraries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Itineraries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recentItineraries.map((itinerary) => (
                <Button
                  key={itinerary.id}
                  variant="outline"
                  size="sm"
                  onClick={() => loadItinerary(itinerary)}
                >
                  {itinerary.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Your Event Trip</CardTitle>
          <CardDescription>
            Enter your travel details and preferences to find the best flights and hotels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Cities Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="originCity">From</Label>
                <Controller
                  name="originCity"
                  control={control}
                  render={({ field }) => (
                    <CityAutocomplete
                      value={field.value || null}
                      onChange={field.onChange}
                      placeholder="Select origin city..."
                      disabled={isSearching}
                    />
                  )}
                />
                {errors.originCity && (
                  <p className="text-sm text-destructive">{errors.originCity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="destinationCity">To</Label>
                <Controller
                  name="destinationCity"
                  control={control}
                  render={({ field }) => (
                    <CityAutocomplete
                      value={field.value || null}
                      onChange={field.onChange}
                      placeholder="Select destination city..."
                      disabled={isSearching}
                    />
                  )}
                />
                {errors.destinationCity && (
                  <p className="text-sm text-destructive">{errors.destinationCity.message}</p>
                )}
              </div>
            </div>

            {/* Dates Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="departureDate">Departure Date</Label>
                <Controller
                  name="departureDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select departure date..."
                      disabled={isSearching}
                      minDate={new Date()}
                    />
                  )}
                />
                {errors.departureDate && (
                  <p className="text-sm text-destructive">{errors.departureDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="returnDate">Return Date</Label>
                <Controller
                  name="returnDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select return date..."
                      disabled={isSearching}
                      minDate={formValues.departureDate || new Date()}
                    />
                  )}
                />
                {errors.returnDate && (
                  <p className="text-sm text-destructive">{errors.returnDate.message}</p>
                )}
              </div>
            </div>

            {/* Preferences */}
            <Controller
              name="preferences"
              control={control}
              render={({ field }) => (
                <PreferencesTextarea
                  value={field.value || ""}
                  onChange={field.onChange}
                  disabled={isSearching}
                />
              )}
            />

            {/* Error Display */}
            {error && (
              <div className="rounded-md bg-destructive/15 p-4 text-destructive">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search Flights & Hotels
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {(results || isSearching) && (
        <div className="space-y-4">
          {results && (
            <div className="flex gap-2 justify-end">
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Save className="mr-2 h-4 w-4" />
                    Save Itinerary
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Itinerary</DialogTitle>
                    <DialogDescription>
                      Give your itinerary a name to save it for later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input
                      placeholder="e.g., NYC Tech Conference Trip"
                      value={itineraryName}
                      onChange={(e) => setItineraryName(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveItinerary} disabled={!itineraryName.trim()}>
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline" onClick={handleExportItinerary}>
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
            </div>
          )}

          <ResultsDisplay results={results} loading={isSearching} />
        </div>
      )}
    </div>
  )
}
