import { useState } from 'react'
import axios from 'axios'
import type { Song, SpotifyCandidate } from '../types'

interface Props {
  song: Song
  onTrackLinked: (updated: Song) => void
}

type Phase = 'embed' | 'no-id' | 'searching' | 'picking' | 'saving'

export default function SpotifyPreview({ song, onTrackLinked }: Props) {
  const [trackId, setTrackId] = useState<string | null>(song.spotify_track_id)
  const [phase, setPhase] = useState<Phase>(song.spotify_track_id ? 'embed' : 'no-id')
  const [candidates, setCandidates] = useState<SpotifyCandidate[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)

  const search = async () => {
    setPhase('searching')
    setSearchError(null)
    try {
      // First try: title + artist
      const { data: r1 } = await axios.get('/api/songs/search', {
        params: { title: song.title, artist: song.artist },
      })
      if (r1.length > 0) {
        setCandidates(r1); setPhase('picking'); return
      }

      // Second try: title + first source label (if available)
      if (song.source_labels.length > 0) {
        const { data: r2 } = await axios.get('/api/songs/search', {
          params: { title: song.title, artist: song.source_labels[0] },
        })
        if (r2.length > 0) {
          setCandidates(r2); setPhase('picking'); return
        }
      }

      // Both searches exhausted
      setCandidates([])
      setPhase('picking')
    } catch {
      setSearchError('Search failed')
      setPhase(trackId ? 'embed' : 'no-id')
    }
  }

  const pick = async (candidate: SpotifyCandidate) => {
    setPhase('saving')
    try {
      const { data: updated } = await axios.patch(`/api/songs/${song.id}`, {
        spotify_track_id: candidate.spotifyTrackId,
      })
      setTrackId(candidate.spotifyTrackId)
      setPhase('embed')
      onTrackLinked(updated)
    } catch {
      setSearchError('Failed to save')
      setPhase('picking')
    }
  }

  const cancel = () => setPhase(trackId ? 'embed' : 'no-id')

  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

  if (phase === 'no-id') {
    return (
      <div className="mt-2 flex items-center gap-2" onClick={stopProp}>
        <button
          onClick={search}
          className="text-xs text-blue-500 hover:text-blue-700 underline"
        >
          Find on Spotify
        </button>
        {searchError && <span className="text-xs text-red-500">{searchError}</span>}
      </div>
    )
  }

  if (phase === 'searching') {
    return (
      <div className="mt-2 text-xs text-gray-400" onClick={stopProp}>Searching Spotify…</div>
    )
  }

  if (phase === 'picking') {
    return (
      <div className="mt-2" onClick={stopProp}>
        {candidates.length === 0 ? (
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400">No results found.</p>
            <button onClick={() => search()} className="text-xs text-blue-500 hover:text-blue-700">Try again</button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-500 mb-1">Select the correct version:</p>
            {candidates.map(c => (
              <button
                key={c.spotifyTrackId}
                onClick={() => pick(c)}
                className="text-left text-xs px-2 py-1.5 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <span className="font-medium text-gray-800">{c.title}</span>
                <span className="text-gray-500"> — {c.artist}</span>
                <span className="text-gray-400"> · {c.album}</span>
                {c.isLive && (
                  <span className="ml-1 text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded">Live</span>
                )}
              </button>
            ))}
          </div>
        )}
        <button onClick={cancel} className="mt-1.5 text-xs text-gray-400 hover:text-gray-600">
          Cancel
        </button>
        {searchError && <p className="text-xs text-red-500 mt-1">{searchError}</p>}
      </div>
    )
  }

  if (phase === 'saving') {
    return <div className="mt-2 text-xs text-gray-400" onClick={stopProp}>Linking…</div>
  }

  // phase === 'embed'
  return (
    <div className="mt-2" onClick={stopProp}>
      <iframe
        src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
        width="100%"
        height="80"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="rounded"
      />
      <button
        onClick={search}
        className="mt-1 text-xs text-gray-400 hover:text-gray-600"
      >
        Wrong track?
      </button>
    </div>
  )
}
