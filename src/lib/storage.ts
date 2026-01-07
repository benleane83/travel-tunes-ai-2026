import { v4 as uuidv4 } from 'uuid';
import { SavedItinerary, SearchResults, City } from './types';

const STORAGE_KEY = 'travel-planner-itineraries';
const DRAFT_KEY = 'travel-planner-draft';
const MAX_AGE_DAYS = 30;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

export interface DraftFormData {
  originCity: City | null;
  destinationCity: City | null;
  departureDate: string | null;
  returnDate: string | null;
  preferences: string;
}

// Get all saved itineraries
export function getItineraries(): SavedItinerary[] {
  if (!isBrowser) return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const itineraries: SavedItinerary[] = JSON.parse(stored);
    return itineraries.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    console.error('Error loading itineraries:', error);
    return [];
  }
}

// Save a new itinerary
export function saveItinerary(
  name: string,
  formData: SavedItinerary['formData'],
  results?: SearchResults
): SavedItinerary {
  if (!isBrowser) {
    throw new Error('Cannot save itinerary: not in browser environment');
  }

  const itineraries = getItineraries();
  const now = new Date().toISOString();
  
  const newItinerary: SavedItinerary = {
    id: uuidv4(),
    name,
    createdAt: now,
    updatedAt: now,
    formData,
    results,
    isDraft: false,
  };
  
  itineraries.unshift(newItinerary);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(itineraries));
  
  return newItinerary;
}

// Update an existing itinerary
export function updateItinerary(
  id: string,
  updates: Partial<Omit<SavedItinerary, 'id' | 'createdAt'>>
): SavedItinerary | null {
  if (!isBrowser) return null;

  const itineraries = getItineraries();
  const index = itineraries.findIndex(it => it.id === id);
  
  if (index === -1) return null;
  
  itineraries[index] = {
    ...itineraries[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(itineraries));
  return itineraries[index];
}

// Delete an itinerary
export function deleteItinerary(id: string): boolean {
  if (!isBrowser) return false;

  const itineraries = getItineraries();
  const filtered = itineraries.filter(it => it.id !== id);
  
  if (filtered.length === itineraries.length) return false;
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

// Get a single itinerary by ID
export function getItinerary(id: string): SavedItinerary | null {
  const itineraries = getItineraries();
  return itineraries.find(it => it.id === id) || null;
}

// Auto-save draft
export function saveDraft(formData: DraftFormData): void {
  if (!isBrowser) return;

  try {
    const draft = {
      formData,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error('Error saving draft:', error);
  }
}

// Load draft
export function loadDraft(): DraftFormData | null {
  if (!isBrowser) return null;

  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    
    const { formData } = JSON.parse(stored);
    return formData;
  } catch (error) {
    console.error('Error loading draft:', error);
    return null;
  }
}

// Clear draft
export function clearDraft(): void {
  if (!isBrowser) return;
  localStorage.removeItem(DRAFT_KEY);
}

// Cleanup old drafts (>30 days old)
export function cleanupOldItineraries(): number {
  if (!isBrowser) return 0;

  const itineraries = getItineraries();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);
  
  const filtered = itineraries.filter(it => {
    if (it.isDraft) {
      return new Date(it.updatedAt) > cutoffDate;
    }
    return true; // Keep non-drafts
  });
  
  const removedCount = itineraries.length - filtered.length;
  
  if (removedCount > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
  
  return removedCount;
}

// Export itinerary to JSON
export function exportItinerary(id: string): string | null {
  const itinerary = getItinerary(id);
  if (!itinerary) return null;
  
  return JSON.stringify(itinerary, null, 2);
}

// Export all itineraries to JSON
export function exportAllItineraries(): string {
  const itineraries = getItineraries();
  return JSON.stringify(itineraries, null, 2);
}

// Import itineraries from JSON
export function importItineraries(jsonString: string): number {
  if (!isBrowser) return 0;

  try {
    const imported: SavedItinerary[] = JSON.parse(jsonString);
    const existing = getItineraries();
    
    // Avoid duplicates by ID
    const existingIds = new Set(existing.map(it => it.id));
    const newItineraries = imported.filter(it => !existingIds.has(it.id));
    
    const combined = [...existing, ...newItineraries];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
    
    return newItineraries.length;
  } catch (error) {
    console.error('Error importing itineraries:', error);
    return 0;
  }
}

// Get recent itineraries (last 5)
export function getRecentItineraries(limit: number = 5): SavedItinerary[] {
  return getItineraries().slice(0, limit);
}
