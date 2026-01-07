"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { City } from "@/lib/types"

interface CityAutocompleteProps {
  value: City | null
  onChange: (city: City | null) => void
  placeholder?: string
  disabled?: boolean
}

interface LocationResult {
  iataCode: string
  name: string
  cityName: string
  countryName: string
  subType: string
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = "Select city...",
  disabled = false,
}: CityAutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [locations, setLocations] = React.useState<LocationResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchLocations = React.useCallback(async (query: string) => {
    if (query.length < 2) {
      setLocations([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/locations?keyword=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || [])
      } else {
        setLocations([])
      }
    } catch (error) {
      console.error("Error searching locations:", error)
      setLocations([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (search.length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchLocations(search)
      }, 300) // 300ms debounce
    } else {
      setLocations([])
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [search, searchLocations])

  const handleSelect = (location: LocationResult) => {
    onChange({
      name: `${location.cityName || location.name}, ${location.countryName}`,
      iataCode: location.iataCode,
    })
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value ? `${value.name} (${value.iataCode})` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search cities..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            )}
            {!loading && search.length >= 2 && locations.length === 0 && (
              <CommandEmpty>No cities found.</CommandEmpty>
            )}
            {!loading && search.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search...
              </div>
            )}
            {!loading && locations.length > 0 && (
              <CommandGroup heading="Cities & Airports">
                {locations.map((location) => (
                  <CommandItem
                    key={`${location.iataCode}-${location.name}`}
                    value={location.iataCode}
                    onSelect={() => handleSelect(location)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value?.iataCode === location.iataCode
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {location.cityName || location.name} ({location.iataCode})
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {location.name} • {location.countryName}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
