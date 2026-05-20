import { useState } from 'react'
import SpotifyPreview from './SpotifyPreview'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Song, Arrangement, SetItem } from '../types'

function CopyButton({ setList }: { setList: SetItem[] }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = setList
      .map((item, i) => `${i + 1}. ${item.song.title} — ${item.arrangement.key_signature} (${item.arrangement.tempo_bpm} BPM)`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`text-xs px-2 py-1 transition-colors ${copied ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'}`}
      title="Copy set to clipboard"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

interface Props {
  setList: SetItem[]
  onRemove: (songId: string) => void
  onReorder: (items: SetItem[]) => void
  onUseAsAnchor: (song: Song, arrangement: Arrangement) => void
  onClearAll: () => void
  onSongUpdate: (song: Song) => void
}

type FlowNotice = { type: 'warning' | 'info' | 'positive'; text: string }

function getFlowNotices(a: SetItem, b: SetItem): FlowNotice[] {
  const arrA = a.arrangement
  const arrB = b.arrangement
  if (!arrA || !arrB) return []

  const notices: FlowNotice[] = []

  // Key
  const diff = Math.abs(arrA.key_number - arrB.key_number) % 12
  const distance = Math.min(diff, 12 - diff)
  const aMinor = arrA.key_signature.endsWith('m')
  const bMinor = arrB.key_signature.endsWith('m')
  const isRelative = distance === 3 && aMinor !== bMinor

  if (distance === 0) {
    notices.push({ type: 'positive', text: `Same key (${arrA.key_signature})` })
  } else if (isRelative) {
    notices.push({ type: 'positive', text: `Relative keys — ${arrA.key_signature} → ${arrB.key_signature}` })
  } else if (distance === 5) {
    notices.push({ type: 'info', text: `Compatible keys — ${arrA.key_signature} → ${arrB.key_signature}` })
  } else if (distance <= 4) {
    notices.push({ type: 'info', text: `Key change — ${arrA.key_signature} → ${arrB.key_signature}` })
  } else {
    notices.push({ type: 'warning', text: `Difficult key change — ${arrA.key_signature} → ${arrB.key_signature}` })
  }

  // Tempo
  const bpmDiff = Math.abs(arrA.tempo_bpm - arrB.tempo_bpm)
  if (bpmDiff === 0) {
    notices.push({ type: 'positive', text: `Same tempo (${arrA.tempo_bpm} BPM)` })
  } else if (bpmDiff > 35) {
    notices.push({ type: 'warning', text: `Big tempo shift (${arrA.tempo_bpm} → ${arrB.tempo_bpm} BPM)` })
  } else if (bpmDiff > 20) {
    notices.push({ type: 'info', text: `Tempo change (${arrA.tempo_bpm} → ${arrB.tempo_bpm} BPM)` })
  } else {
    notices.push({ type: 'positive', text: `Similar tempo (${arrA.tempo_bpm} → ${arrB.tempo_bpm} BPM)` })
  }

  // Meter
  const sigA = arrA.time_signature
  const sigB = arrB.time_signature
  if (sigA === sigB) {
    notices.push({ type: 'positive', text: `Same time signature (${sigA})` })
  } else {
    notices.push({ type: 'info', text: `Time signature change (${sigA} → ${sigB})` })
  }

  // Themes
  const themesA = a.song.song_metadata?.themes ?? []
  const themesB = b.song.song_metadata?.themes ?? []
  const shared = themesA.filter(t => themesB.includes(t))
  if (shared.length > 0) {
    notices.push({ type: 'positive', text: `Shared themes: ${shared.join(', ')}` })
  }

  return notices
}

function listWords(words: string[]): string {
  if (words.length === 1) return words[0]
  if (words.length === 2) return `${words[0]} and ${words[1]}`
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`
}

function buildNaturalSummary(transitionNotices: FlowNotice[][], setLength: number): string[] {
  if (setLength < 2 || transitionNotices.length === 0) return []
  const n = transitionNotices.length
  const sentences: string[] = []

  // Key
  const goodKeyCount = transitionNotices.filter(notices =>
    notices.some(n => n.type === 'positive' && (n.text.startsWith('Same key') || n.text.startsWith('Relative')))
  ).length

  if (goodKeyCount === n) {
    const allSame = transitionNotices.every(notices => notices.some(n => n.text.startsWith('Same key')))
    if (allSame) {
      const key = transitionNotices[0].find(n => n.text.startsWith('Same key'))?.text.match(/\((.+)\)/)?.[1]
      sentences.push(key ? `The whole set sits in ${key} — no key changes needed.` : `Keys are consistent throughout.`)
    } else {
      sentences.push(`Keys flow naturally from song to song.`)
    }
  } else if (goodKeyCount >= Math.ceil(n / 2)) {
    sentences.push(`Key transitions are smooth for most of the set.`)
  }

  // Tempo
  const goodTempoCount = transitionNotices.filter(notices =>
    notices.some(n => n.type === 'positive' && (n.text.startsWith('Same tempo') || n.text.startsWith('Similar tempo')))
  ).length

  if (goodTempoCount === n) {
    const allSame = transitionNotices.every(notices => notices.some(n => n.text.startsWith('Same tempo')))
    if (allSame) {
      const bpm = transitionNotices[0].find(n => n.text.startsWith('Same tempo'))?.text.match(/\((\d+)/)?.[1]
      sentences.push(bpm ? `Tempo is locked in at ${bpm} BPM throughout.` : `Tempo is consistent throughout.`)
    } else {
      sentences.push(`Tempo stays consistent throughout.`)
    }
  } else if (goodTempoCount >= Math.ceil(n / 2)) {
    sentences.push(`Tempo holds steady for most of the set.`)
  }

  // Themes
  const themeEntries: { i: number; themes: string[] }[] = []
  transitionNotices.forEach((notices, i) => {
    const notice = notices.find(n => n.type === 'positive' && n.text.startsWith('Shared themes'))
    if (notice) themeEntries.push({ i, themes: notice.text.replace('Shared themes: ', '').split(', ') })
  })

  if (themeEntries.length > 0) {
    const themeCount = new Map<string, number>()
    themeEntries.forEach(({ themes }) => themes.forEach(t => themeCount.set(t, (themeCount.get(t) ?? 0) + 1)))
    const topThemes = [...themeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)

    if (themeEntries.length === n && n > 1) {
      sentences.push(`A thread of ${listWords(topThemes)} runs through the whole set.`)
    } else if (themeEntries.length > 1) {
      sentences.push(`Themes of ${listWords(topThemes)} connect several songs together.`)
    } else {
      const { i, themes } = themeEntries[0]
      sentences.push(`Songs ${i + 1} and ${i + 2} connect through ${listWords(themes)}.`)
    }
  }

  return sentences
}

function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 flex-shrink-0 touch-none"
      aria-label="Drag to reorder"
    >
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="2" cy="2.5" r="1.5" />
        <circle cx="8" cy="2.5" r="1.5" />
        <circle cx="2" cy="7" r="1.5" />
        <circle cx="8" cy="7" r="1.5" />
        <circle cx="2" cy="11.5" r="1.5" />
        <circle cx="8" cy="11.5" r="1.5" />
      </svg>
    </button>
  )
}

function SortableSongItem({
  item, index, notices, onRemove, onUseAsAnchor, previewOpen, onTogglePreview, onSongUpdate,
}: {
  item: SetItem
  index: number
  notices: FlowNotice[]
  onRemove: (songId: string) => void
  onUseAsAnchor: (song: Song, arrangement: Arrangement) => void
  previewOpen: boolean
  onTogglePreview: () => void
  onSongUpdate: (song: Song) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.song.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const warnings = notices.filter(n => n.type === 'warning')
  const infos = notices.filter(n => n.type === 'info')
  const arr = item.arrangement

  return (
    <div ref={setNodeRef} style={style}>
      {(warnings.length > 0 || infos.length > 0) && (
        <div className="flex flex-col gap-0.5 mb-1">
          {warnings.map((n, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
              <span className="flex-shrink-0">⚠</span>
              {n.text}
            </div>
          ))}
          {infos.map((n, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
              <span className="flex-shrink-0 font-bold">i</span>
              {n.text}
            </div>
          ))}
        </div>
      )}
      <div className={`border border-gray-200 rounded-lg p-2.5 bg-white ${isDragging ? 'shadow-lg' : ''}`}>
        <div className="flex items-center gap-2">
          <DragHandle {...attributes} {...listeners} />
          <span className="text-xs text-gray-400 w-4 text-center flex-shrink-0">{index + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-800 truncate text-xs">{item.song.title}</div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <span>{arr.key_signature} · {arr.tempo_bpm} BPM</span>
              {!arr.is_primary && (
                <span className="text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded">alt</span>
              )}
            </div>
          </div>
          <button
            onClick={onTogglePreview}
            className={`text-xs flex-shrink-0 transition-colors ${previewOpen ? 'text-green-500' : 'text-gray-300 hover:text-green-500'}`}
            title="Preview"
          >▶</button>
          <button
            onClick={() => onUseAsAnchor(item.song, item.arrangement)}
            className="text-xs text-blue-400 hover:text-blue-600 px-1 flex-shrink-0"
            title="Use as anchor"
          >⚓</button>
          <button
            onClick={() => onRemove(item.song.id)}
            className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0"
          >✕</button>
        </div>
        {previewOpen && (
          <div className="mt-2 px-1">
            <SpotifyPreview song={item.song} onTrackLinked={onSongUpdate} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function SetBuilder({ setList, onRemove, onReorder, onUseAsAnchor, onClearAll, onSongUpdate }: Props) {
  const [previewSongId, setPreviewSongId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = setList.findIndex(item => item.song.id === active.id)
      const newIndex = setList.findIndex(item => item.song.id === over.id)
      onReorder(arrayMove(setList, oldIndex, newIndex))
    }
  }

  const keys = setList.map(item => item.arrangement.key_signature).filter(Boolean)
  const bpms = setList.map(item => item.arrangement.tempo_bpm).filter(Boolean)

  // Pre-compute all transition notices, suppressing the first big tempo shift
  // (one large tempo change is expected in a typical set).
  const rawNotices = setList.slice(1).map((item, i) => getFlowNotices(setList[i], item))
  let bigTempoShiftsSeen = 0
  const transitionNotices = rawNotices.map(notices =>
    notices.map(n => {
      if (n.type === 'warning' && n.text.startsWith('Big tempo')) {
        bigTempoShiftsSeen++
        if (bigTempoShiftsSeen === 1) return { ...n, type: 'info' as const }
      }
      return n
    })
  )

  const summary = buildNaturalSummary(transitionNotices, setList.length)

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Current Set</h2>
          <p className="text-xs text-gray-500">{setList.length} songs</p>
        </div>
        {setList.length > 0 && (
          <div className="flex items-center gap-2">
            <CopyButton setList={setList} />
            <button
              onClick={onClearAll}
              className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {setList.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">
            Add songs from the list
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={setList.map(item => item.song.id)} strategy={verticalListSortingStrategy}>
            {setList.map((item, index) => (
              <SortableSongItem
                key={item.song.id}
                item={item}
                index={index}
                notices={index > 0 ? transitionNotices[index - 1] : []}
                onRemove={onRemove}
                onUseAsAnchor={onUseAsAnchor}
                previewOpen={previewSongId === item.song.id}
                onTogglePreview={() => setPreviewSongId(prev => prev === item.song.id ? null : item.song.id)}
                onSongUpdate={onSongUpdate}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Set highlights */}
        {summary.length > 0 && (
          <div className="mt-1 border border-green-200 bg-green-50 rounded-lg px-3 py-2 flex flex-col gap-1">
            {summary.map((s, i) => (
              <p key={i} className="text-xs text-green-700">{s}</p>
            ))}
          </div>
        )}
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
