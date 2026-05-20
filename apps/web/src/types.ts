export interface Arrangement {
  id: string
  name?: string
  source_label?: string
  key_signature: string
  key_number: number
  tempo_bpm: number
  time_signature: string
  energy_level: number
  is_primary: boolean
}

export interface SongMetadata {
  themes: string[]
  theological_depth: number
  style: string
  is_hymn: boolean
}

export interface Song {
  id: string
  title: string
  artist: string
  source_labels: string[]
  album: string | null
  released_at: string | null
  released_year: number | null
  ccli_number: string | null
  spotify_track_id: string | null
  pco_song_id: string | null
  last_scheduled_at: string | null
  is_retired: boolean
  created_at: string
  updated_at: string
  arrangements: Arrangement[]
  song_metadata: SongMetadata | null
}

export interface SetItem {
  song: Song
  arrangement: Arrangement
}

export interface SuggestionResult {
  song: {
    id: string
    title: string
    artist: string
    keyNumber: number
    keySignature: string
    tempoBpm: number
    timeSignature: string
    energyLevel: number
    themes: string[]
    arrangementId?: string
  }
  total: number
  breakdown: {
    key: number
    tempo: number
    meter: number
    energy: number
    theme: number
  }
  reasons: string[]
}

export interface SpotifyCandidate {
  spotifyTrackId: string
  title: string
  artist: string
  album: string
  releasedAt: string
  isLive: boolean
}

export interface PcoPreviewItem {
  pcoId: string
  title: string
  author: string
  ccliNumber: string | null
  hidden: boolean
  status: 'imported' | 'match' | 'new'
  existingSongId: string | null
  existingTitle: string | null
  matchedBy: 'ccli' | 'title' | null
}

export interface PcoImportResult {
  added: number
  matched: number
  skipped: number
  errors: string[]
}

export interface SuggestionsResponse {
  anchor: SuggestionResult['song']
  suggestions: SuggestionResult[]
}

export interface ClientFilters {
  keys: string[]
  bpmMin: number | ''
  bpmMax: number | ''
  energy: number[]
  theologicalDepth: number[]
  themes: string[]
  pcoNotUsedMonths: number | ''
}
