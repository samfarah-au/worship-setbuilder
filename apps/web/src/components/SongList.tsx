import { useState } from 'react'
import type { Song, Arrangement, SuggestionResult } from '../types'
import SpotifyPreview from './SpotifyPreview'
import HelpBanner from './HelpBanner'

// Renders an arrangement chip. When no anchor is active the chip is split:
// left side sets the anchor, right "+" adds directly to the set.
function ArrChip({
  arr, isAnchorSelected, isAnchorCard, isSelectedArr, isMatched,
  onAnchorOrPair, onAddToSet, label,
}: {
  arr: Arrangement
  isAnchorSelected: boolean
  isAnchorCard: boolean
  isSelectedArr: boolean
  isMatched: boolean
  onAnchorOrPair: () => void
  onAddToSet: () => void
  label: string
}) {
  const chipText = `${arr.key_signature} · ${arr.tempo_bpm} BPM · ${arr.time_signature}`
  const baseClass = 'text-xs border transition-colors'

  let colorClass: string
  if (isAnchorCard && isSelectedArr) {
    colorClass = 'bg-blue-100 text-blue-700 border-blue-300'
  } else if (isMatched) {
    colorClass = 'bg-green-600 text-white border-green-600 hover:bg-green-700'
  } else if (isAnchorSelected && !isAnchorCard) {
    colorClass = 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:border-green-400'
  } else {
    colorClass = label === 'primary'
      ? 'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-400'
      : 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400'
  }

  const prefix = isAnchorSelected && !isAnchorCard ? '+ ' : ''

  // When an anchor is active, the whole chip is one button (existing behaviour)
  if (isAnchorSelected) {
    return (
      <button
        onClick={e => { e.stopPropagation(); onAnchorOrPair() }}
        title={`Add pair using ${arr.key_signature} · ${arr.tempo_bpm} BPM`}
        className={`${baseClass} ${colorClass} px-1.5 py-0.5 rounded`}
      >
        {prefix}{chipText}
        {arr.name && <span className="ml-1 opacity-70">{arr.name}</span>}
      </button>
    )
  }

  // No anchor active: split chip — left = set anchor, right "+" = add to set
  return (
    <span className={`inline-flex rounded overflow-hidden ${baseClass} ${colorClass}`}>
      <button
        onClick={e => { e.stopPropagation(); onAnchorOrPair() }}
        title="Use as anchor"
        className="px-1.5 py-0.5"
      >
        {chipText}
        {arr.name && <span className="ml-1 opacity-70">{arr.name}</span>}
      </button>
      <button
        onClick={e => { e.stopPropagation(); onAddToSet() }}
        title="Add to set"
        className="px-1.5 py-0.5 border-l border-current opacity-60 hover:opacity-100"
      >
        +
      </button>
    </span>
  )
}

interface Props {
  songs: Song[]
  selectedSong: Song | null
  selectedArrangement: Arrangement | null
  onSelectAnchor: (song: Song, arrangement: Arrangement) => void
  onClearAnchor: () => void
  suggestions: SuggestionResult[]
  loading: boolean
  onAddToSet: (song: Song, arrangement: Arrangement) => void
  onAddPairToSet: (song: Song, arrangement: Arrangement) => void
  search: string
  onSearchChange: (val: string) => void
  showRetired: boolean
  onToggleShowRetired: () => void
  onRetire: (song: Song) => void
  onSongUpdate: (song: Song) => void
  onEditInAdmin: (song: Song) => void
}

function reasonColor(reason: string): string {
  if (/^(Same |Relative (major|minor)|Shared themes|In your PCO)/.test(reason)) return 'text-green-600'
  if (/^(Difficult key|Big tempo|Incompatible)/.test(reason)) return 'text-red-500'
  return 'text-amber-600'
}

export default function SongList({
  songs, selectedSong, selectedArrangement, onSelectAnchor, onClearAnchor,
  suggestions, loading, onAddToSet, onAddPairToSet,
  search, onSearchChange, showRetired, onToggleShowRetired, onRetire, onSongUpdate, onEditInAdmin,
}: Props) {
  const [previewSongId, setPreviewSongId] = useState<string | null>(null)
  const suggestionMap = new Map(suggestions.map(s => [s.song.id, s]))

  const helpText = selectedSong
    ? `Songs are ranked by how well they pair with "${selectedSong.title}". Click an arrangement chip to add a pair, or use "add pair" to add the best-matched arrangement.`
    : 'Use the sidebar to filter by source or release year. Click a song\'s arrangement chip to anchor it — the list reorders to show the best pairing suggestions.'

  // Filter by search
  const filtered = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.artist.toLowerCase().includes(search.toLowerCase())
  )

  // Sort: if anchor selected, sort by score descending
  // anchor song pinned at top, unscored songs at bottom
  const sorted = selectedSong
    ? [
        // Anchor first
        ...filtered.filter(s => s.id === selectedSong.id),
        // Scored suggestions in order
        ...suggestions
          .map(s => filtered.find(f => f.id === s.song.id))
          .filter((s): s is Song => !!s),
        // Remaining songs not in suggestions
        ...filtered.filter(s =>
          s.id !== selectedSong.id && !suggestionMap.has(s.id)
        ),
      ]
    : filtered.sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <HelpBanner id="library" text={helpText} />

      {/* Search bar */}
      <div className="p-3 border-b border-gray-200 bg-white flex flex-col gap-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Search songs or artists..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-gray-400 pr-7"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs leading-none"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={onToggleShowRetired}
          className={`text-xs self-start px-2 py-0.5 rounded border transition-colors ${
            showRetired
              ? 'bg-amber-50 text-amber-700 border-amber-300'
              : 'text-gray-400 border-transparent hover:text-gray-600'
          }`}
        >
          {showRetired ? 'Showing retired songs' : 'Show retired songs'}
        </button>
      </div>

      {/* Anchor banner */}
      {selectedSong && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 flex items-center gap-3">
          <div className="flex-1">
            <div className="font-medium text-blue-800 flex items-center gap-1.5"><span className="text-base leading-none">⚓</span>{selectedSong.title}</div>
            <div className="text-xs text-blue-600">
              {selectedSong.artist}
              {selectedArrangement && <> · {selectedArrangement.key_signature} · {selectedArrangement.tempo_bpm} BPM</>}
              {selectedArrangement && !selectedArrangement.is_primary && <span className="ml-1 text-blue-400 italic">· alternate arrangement</span>}
            </div>
          </div>
          <button
            onClick={onClearAnchor}
            className="text-xs text-blue-400 hover:text-blue-600 px-2"
          >
            ✕ clear
          </button>
        </div>
      )}

      {/* Song list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-4">Finding suggestions...</p>
        )}

        {!loading && sorted.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No songs found</p>
        )}

        {!loading && sorted.map(song => {
          const suggestion = suggestionMap.get(song.id)
          const isAnchor = selectedSong?.id === song.id
          const score = suggestion ? Math.round(suggestion.total * 100) : null
          const primaryArr = song.arrangements.find(a => a.is_primary) ?? song.arrangements[0]
          const altArrangements = song.arrangements.filter(a => !a.is_primary)

          // Which arrangement was used for this suggestion's scoring
          const suggestionArr = suggestion?.song.arrangementId
            ? song.arrangements.find(a => a.id === suggestion.song.arrangementId) ?? primaryArr
            : primaryArr

          return (
            <div
              key={song.id}
              onClick={() => !isAnchor && primaryArr && onSelectAnchor(song, primaryArr)}
              className={`border rounded-lg p-3 transition-all ${song.is_retired ? 'opacity-50' : ''} ${
                isAnchor
                  ? 'border-blue-300 bg-blue-50 cursor-default'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className={`font-medium flex items-center gap-1.5 ${isAnchor ? 'text-blue-800' : 'text-gray-800'}`}>
                    {isAnchor && <span className="text-base leading-none">⚓</span>}
                    {song.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-1">
                    <span>{song.artist}</span>
                    <span>·</span>
                    {song.source_labels.map(l => (
                      <span key={l} className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-px rounded text-xs">{l}</span>
                    ))}
                    {song.arrangements.filter(a => !a.is_primary && a.source_label).map(a => (
                      <span key={a.id} className="bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-px rounded text-xs">{a.source_label}</span>
                    ))}
                    <span>·</span>
                    <span>{song.released_at?.split('-')[0]}</span>
                  </div>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {primaryArr && (
                      <ArrChip
                        key={primaryArr.id}
                        arr={primaryArr}
                        label="primary"
                        isAnchorSelected={!!selectedSong}
                        isAnchorCard={isAnchor}
                        isSelectedArr={isAnchor && selectedArrangement?.id === primaryArr.id}
                        isMatched={!!(suggestion && !isAnchor && suggestionArr?.id === primaryArr.id)}
                        onAnchorOrPair={() => selectedSong && !isAnchor ? onAddPairToSet(song, primaryArr) : onSelectAnchor(song, primaryArr)}
                        onAddToSet={() => onAddToSet(song, primaryArr)}
                      />
                    )}
                    {altArrangements.map(arr => (
                      <ArrChip
                        key={arr.id}
                        arr={arr}
                        label="alt"
                        isAnchorSelected={!!selectedSong}
                        isAnchorCard={isAnchor}
                        isSelectedArr={isAnchor && selectedArrangement?.id === arr.id}
                        isMatched={!!(suggestion && !isAnchor && suggestionArr?.id === arr.id)}
                        onAnchorOrPair={() => selectedSong && !isAnchor ? onAddPairToSet(song, arr) : onSelectAnchor(song, arr)}
                        onAddToSet={() => onAddToSet(song, arr)}
                      />
                    ))}
                  </div>
                  {(primaryArr?.energy_level || song.song_metadata?.theological_depth) && (
                    <div className="flex items-center gap-3 mt-1.5">
                      {primaryArr?.energy_level != null && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">Energy</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(i => (
                              <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${i <= primaryArr.energy_level ? 'bg-sky-400' : 'bg-gray-200'}`} />
                            ))}
                          </div>
                        </div>
                      )}
                      {song.song_metadata?.theological_depth != null && song.song_metadata.theological_depth > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">Depth</span>
                          <div className="flex gap-0.5">
                            {[1,2,3].map(i => (
                              <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${i <= song.song_metadata!.theological_depth ? 'bg-purple-400' : 'bg-gray-200'}`} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {(song.song_metadata?.themes?.length ?? 0) > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {song.song_metadata?.themes?.map(theme => (
                        <span key={theme} className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Spotify preview */}
                  <div className="mt-1.5">
                    <button
                      onClick={e => { e.stopPropagation(); setPreviewSongId(previewSongId === song.id ? null : song.id) }}
                      className="text-xs text-gray-400 hover:text-green-600 transition-colors"
                    >
                      {previewSongId === song.id ? '▼ hide preview' : '▶ preview'}
                    </button>
                    {previewSongId === song.id && (
                      <SpotifyPreview
                        song={song}
                        onTrackLinked={updated => { onSongUpdate(updated); }}
                      />
                    )}
                  </div>

                  {/* Match reasons */}
                  {suggestion && !isAnchor && (
                    <div className="mt-2 flex flex-col gap-0.5">
                      {suggestion.reasons.map((reason, i) => (
                        <div key={i} className={`text-xs ${reasonColor(reason)}`}>→ {reason}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score, metadata, add button */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); onEditInAdmin(song) }}
                    className="text-gray-300 hover:text-blue-500 transition-colors"
                    title="Edit in Admin"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z"/>
                    </svg>
                  </button>
                  {score !== null && !isAnchor && (
                    <div className={`text-sm font-semibold ${
                      score >= 80 ? 'text-green-600' :
                      score >= 60 ? 'text-purple-600' : 'text-gray-400'
                    }`}>
                      {score}%
                    </div>
                  )}
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      if (selectedSong && !isAnchor) {
                        onAddPairToSet(song, suggestionArr)
                      } else if (primaryArr) {
                        onAddToSet(song, primaryArr)
                      }
                    }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-0.5 rounded"
                  >
                    {selectedSong && !isAnchor ? '+ add pair' : '+ add'}
                  </button>
                  {song.pco_song_id && (
                    <span className="bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-px rounded text-xs">PCO</span>
                  )}
                  {song.last_scheduled_at && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      last used {new Date(song.last_scheduled_at).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); onRetire(song) }}
                    className={`text-xs mt-0.5 ${song.is_retired ? 'text-amber-600 hover:text-amber-800' : 'text-gray-400 hover:text-red-500'}`}
                    title={song.is_retired ? 'Unretire song' : 'Retire song'}
                  >
                    {song.is_retired ? 'unretire' : 'retire'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}