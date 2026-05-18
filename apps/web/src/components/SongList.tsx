import type { Song, SuggestionResult } from '../types'

interface Props {
  songs: Song[]
  selectedSong: Song | null
  onSelect: (song: Song) => void
  suggestions: SuggestionResult[]
  loading: boolean
  onAddToSet: (song: Song) => void
}

export default function SongList({ songs, selectedSong, onSelect, suggestions, loading, onAddToSet }: Props) {
  const suggestionMap = new Map(suggestions.map(s => [s.song.id, s]))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Selected song banner */}
      {selectedSong && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 flex items-center gap-3">
          <div className="flex-1">
            <div className="font-medium text-blue-800">{selectedSong.title}</div>
            <div className="text-xs text-blue-600">
              {selectedSong.artist} · {selectedSong.arrangements[0]?.key_signature} · {selectedSong.arrangements[0]?.tempo_bpm} BPM · {selectedSong.released_at?.split('-')[0]}
            </div>
          </div>
          <button
            onClick={() => onAddToSet(selectedSong)}
            className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700"
          >
            + Add to set
          </button>
        </div>
      )}

      {/* Song list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {!selectedSong && (
          <p className="text-xs text-gray-400 text-center py-4">
            Select a song to see suggestions
          </p>
        )}

        {loading && (
          <p className="text-xs text-gray-400 text-center py-4">
            Finding suggestions...
          </p>
        )}

        {songs.map(song => {
          const suggestion = suggestionMap.get(song.id)
          const isSelected = selectedSong?.id === song.id
          const score = suggestion ? Math.round(suggestion.total * 100) : null

          return (
            <div
              key={song.id}
              onClick={() => onSelect(song)}
              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className={`font-medium ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                    {song.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {song.artist} · {song.source_label} · {song.released_at?.split('-')[0]}
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

                  {/* Suggestion reasons */}
                  {suggestion && !isSelected && (
                    <div className="mt-2 flex flex-col gap-1">
                      {suggestion.reasons.slice(0, 2).map((reason, i) => (
                        <div key={i} className="text-xs text-gray-500">
                          → {reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score badge */}
                {score !== null && !isSelected && (
                  <div className={`text-sm font-semibold flex-shrink-0 ${
                    score >= 80 ? 'text-green-600' :
                    score >= 60 ? 'text-purple-600' : 'text-gray-400'
                  }`}>
                    {score}%
                  </div>
                )}

                {!isSelected && (
                  <button
                    onClick={e => { e.stopPropagation(); onAddToSet(song) }}
                    className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 px-1"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}