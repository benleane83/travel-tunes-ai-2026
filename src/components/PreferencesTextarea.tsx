"use client"

import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface PreferencesTextareaProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function PreferencesTextarea({
  value,
  onChange,
  disabled = false,
}: PreferencesTextareaProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="preferences">Travel Preferences (Natural Language)</Label>
      <Textarea
        id="preferences"
        placeholder="Describe your travel preferences in natural language. For example:
• 'I prefer morning flights and business class'
• 'Looking for budget airlines and 4-star hotels'
• 'I want luxury travel with first class and 5-star accommodations'
• 'Evening flights are best for me, moderate budget'"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="min-h-[120px] resize-y"
      />
      <p className="text-xs text-muted-foreground">
        Our AI will extract your preferences for cabin class, budget level, hotel rating, 
        and flight timing from your description. Leave blank to use default preferences.
      </p>
    </div>
  )
}
