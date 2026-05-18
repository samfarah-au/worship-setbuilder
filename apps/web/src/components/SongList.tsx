import type { Song, SuggestionResult } from '../types'

interface Props {
  songs: Song[]
  selectedSong: Song | null
  onSelectAnchor: (song: Song) => void
  onClearAnchor: () => void
  suggestions: SuggestionResult[]
  loading: boolean
  onAddToSet: (song: Song) => void
  onAddPairToSet: (song: Song) => void
  search: string
  onSearchChange: (val: string) => void
}

export default function SongList({
  songs, selectedSong, onSelectAnchor, onClearAnchor,
  suggestions, loading, onAddToSet, onAddPairToSet,
  search, onSearchChange,
}: Props) {
  const suggestionMap = new Map(suggestions.map(s => [s.song.id, s]))

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
      {/* Search bar */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <input
          type="text"
          placeholder="Search songs or artists..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-gray-400"
        />
      </div>

      {/* Anchor banner */}
      {selectedSong && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 flex items-center gap-3">
          <div className="flex-1">
            <div className="font-medium text-blue-800">{selectedSong.title}</div>
            <div className="text-xs text-blue-600">
              {selectedSong.artist} · {selectedSong.source_labels.join(', ')} · {selectedSong.arrangements[0]?.key_signature} · {selectedSong.arrangements[0]?.tempo_bpm} BPM
              {' '}· <span className="italic">anchor</span>
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

          return (
            <div
              key={song.id}
              onClick={() => !isAnchor && onSelectAnchor(song)}
              className={`border rounded-lg p-3 transition-all ${
                isAnchor
                  ? 'border-blue-300 bg-blue-50 cursor-default'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className={`font-medium ${isAnchor ? 'text-blue-800' : 'text-gray-800'}`}>
                    {song.title}
                    {isAnchor && <span className="ml-2 text-xs font-normal text-blue-500">anchor</span>}
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
                    {song.arrangements[0] && (
                      <>
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {song.arrangements[0].key_signature}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {song.arrangements[0].tempo_bpm} BPM
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {song.arrangements[0].time_signature}
                        </span>
                      </>
                    )}
                    {song.song_metadata?.themes.slice(0, 2).map(theme => (
                      <span key={theme} className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                        {theme}
                      </span>
                    ))}
                  </div>

                  {/* Match reasons */}
                  {suggestion && !isAnchor && (
                    <div className="mt-2 flex flex-col gap-0.5">
                      {suggestion.reasons.slice(0, 2).map((reason, i) => (
                        <div key={i} className="text-xs text-gray-400">→ {reason}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score + add button */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
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
                        onAddPairToSet(song)
                    } else {
                        onAddToSet(song)
                    }
                    }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-0.5 rounded"
                  >
                    {selectedSong && !isAnchor ? '+ add pair' : '+ add'}
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