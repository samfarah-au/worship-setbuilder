import type { Song } from '../types'

interface Props {
  setList: Song[]
  onRemove: (id: string) => void
  onReorder: (songs: Song[]) => void
}

function getFlowWarning(a: Song, b: Song): string | null {
  const arrA = a.arrangements[0]
  const arrB = b.arrangements[0]
  if (!arrA || !arrB) return null

  const bpmDiff = Math.abs(arrA.tempo_bpm - arrB.tempo_bpm)
  if (bpmDiff >= 40) return `Big tempo shift (${arrA.tempo_bpm} → ${arrB.tempo_bpm} BPM)`

  if (arrA.time_signature !== arrB.time_signature) {
    return `Time signature change (${arrA.time_signature} → ${arrB.time_signature})`
  }

  const keyDiff = Math.abs(arrA.key_number - arrB.key_number) % 12
  const keyDistance = Math.min(keyDiff, 12 - keyDiff)
  if (keyDistance >= 5) return `Key jump (${arrA.key_signature} → ${arrB.key_signature})`

  return null
}

export default function SetBuilder({ setList, onRemove, onReorder }: Props) {
  const moveUp = (index: number) => {
    if (index === 0) return
    const updated = [...setList]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    onReorder(updated)
  }

  const moveDown = (index: number) => {
    if (index === setList.length - 1) return
    const updated = [...setList]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    onReorder(updated)
  }

  const keys = setList.map(s => s.arrangements[0]?.key_signature).filter(Boolean)
  const bpms = setList.map(s => s.arrangements[0]?.tempo_bpm).filter(Boolean)

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Current Set</h2>
          <p className="text-xs text-gray-500">{setList.length} songs</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {setList.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">
            Add songs from the list
          </p>
        )}

        {setList.map((song, index) => {
          const warning = index > 0 ? getFlowWarning(setList[index - 1], song) : null
          const arr = song.arrangements[0]

          return (
            <div key={song.id}>
              {warning && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-1">
                  ⚠ {warning}
                </div>
              )}
              <div className="border border-gray-200 rounded-lg p-2.5 bg-white flex items-center gap-2">
                <span className="text-xs text-gray-400 w-4 text-center">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate text-xs">
                    {song.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {arr?.key_signature} · {arr?.tempo_bpm} BPM
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveUp(index)}
                    className="text-gray-300 hover:text-gray-500 text-xs leading-none"
                  >▲</button>
                  <button
                    onClick={() => moveDown(index)}
                    className="text-gray-300 hover:text-gray-500 text-xs leading-none"
                  >▼</button>
                </div>
                <button
                  onClick={() => onRemove(song.id)}
                  className="text-gray-300 hover:text-red-400 text-xs"
                >✕</button>
              </div>
            </div>
          )
        })}
      </div>

      {setList.length > 0 && (
        <div className="border-t border-gray-200 p-3 flex flex-wrap gap-1.5">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            Keys: {keys.join(', ')}
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {Math.min(...bpms)}–{Math.max(...bpms)} BPM
          </span>
        </div>
      )}
    </div>
  )
}