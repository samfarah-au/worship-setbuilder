import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import type { Song, Arrangement } from '../types'

const KEY_SIGNATURES = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const KEY_TO_NUMBER: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11,
}
const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '2/2', '12/8']
const STYLES = ['modern', 'hymn', 'gospel', 'folk-worship']
const COMMON_THEMES = [
  'praise', 'worship', 'grace', 'salvation', 'hope', 'faith', 'love',
  'surrender', 'holiness', 'presence', 'gratitude', 'redemption',
  'glory', 'victory', 'peace', 'joy', 'trinity', 'resurrection',
]

interface EditState {
  arrangementName: string
  key_signature: string
  tempo_bpm: number
  time_signature: string
  energy_level: number
  themes: string[]
  theological_depth: number
  style: string
  is_hymn: boolean
}

interface NewArrangement {
  name: string
  key_signature: string
  tempo_bpm: number
  time_signature: string
  energy_level: number
}

interface Props {
  onSongUpdate: (song: Song) => void
}

export default function AdminPanel({ onSongUpdate }: Props) {
  const [songs, setSongs] = useState<Song[]>([])
  const [search, setSearch] = useState('')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [themeInput, setThemeInput] = useState('')
  const [newArr, setNewArr] = useState<NewArrangement>({
    name: '', key_signature: 'G', tempo_bpm: 72, time_signature: '4/4', energy_level: 3,
  })
  const [addingArr, setAddingArr] = useState(false)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    axios.get('/api/songs').then(res => setSongs(res.data)).catch(console.error)
  }, [])

  const filtered = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.artist.toLowerCase().includes(search.toLowerCase())
  )

  const primaryDefaults = (song: Song) => {
    const primary = song.arrangements.find(a => a.is_primary) ?? song.arrangements[0]
    return {
      name:           '',
      key_signature:  primary?.key_signature  ?? 'G',
      tempo_bpm:      primary?.tempo_bpm      ?? 72,
      time_signature: primary?.time_signature ?? '4/4',
      energy_level:   primary?.energy_level   ?? 3,
    }
  }

  const openEdit = (song: Song) => {
    setSelectedSong(song)
    const primary = song.arrangements.find(a => a.is_primary) ?? song.arrangements[0]
    setEditState({
      arrangementName:   primary?.name ?? '',
      key_signature:     primary?.key_signature ?? 'G',
      tempo_bpm:         primary?.tempo_bpm ?? 72,
      time_signature:    primary?.time_signature ?? '4/4',
      energy_level:      primary?.energy_level ?? 3,
      themes:            [...(song.song_metadata?.themes ?? [])],
      theological_depth: song.song_metadata?.theological_depth ?? 2,
      style:             song.song_metadata?.style ?? 'modern',
      is_hymn:           song.song_metadata?.is_hymn ?? false,
    })
    setNewArr(primaryDefaults(song))
    setSaveError(null)
    setSaveSuccess(false)
    setAddingArr(false)
  }

  const handleSave = async () => {
    if (!selectedSong || !editState) return
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        name:              editState.arrangementName || null,
        key_signature:     editState.key_signature,
        key_number:        KEY_TO_NUMBER[editState.key_signature] ?? 0,
        tempo_bpm:         editState.tempo_bpm,
        time_signature:    editState.time_signature,
        energy_level:      editState.energy_level,
        themes:            editState.themes,
        theological_depth: editState.theological_depth,
        style:             editState.style,
        is_hymn:           editState.is_hymn,
      }
      const { data: updated } = await axios.patch(`/api/songs/${selectedSong.id}`, payload)
      setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))
      setSelectedSong(updated)
      onSongUpdate(updated)
      setSaveSuccess(true)
      if (successTimer.current) clearTimeout(successTimer.current)
      successTimer.current = setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err: any) {
      setSaveError(err.response?.data?.error ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const addTheme = (theme: string) => {
    const t = theme.trim().toLowerCase()
    if (!t || editState!.themes.includes(t)) return
    setEditState(prev => prev ? { ...prev, themes: [...prev.themes, t] } : prev)
    setThemeInput('')
  }

  const removeTheme = (theme: string) => {
    setEditState(prev => prev ? { ...prev, themes: prev.themes.filter(t => t !== theme) } : prev)
  }

  const handleAddArrangement = async () => {
    if (!selectedSong) return
    setAddingArr(true)
    setSaveError(null)
    try {
      const { data } = await axios.post(`/api/songs/${selectedSong.id}/arrangements`, {
        name:           newArr.name || null,
        key_signature:  newArr.key_signature,
        key_number:     KEY_TO_NUMBER[newArr.key_signature] ?? 0,
        tempo_bpm:      newArr.tempo_bpm,
        time_signature: newArr.time_signature,
        energy_level:   newArr.energy_level,
      })
      const updated = { ...selectedSong, arrangements: [...selectedSong.arrangements, data] }
      setSelectedSong(updated)
      setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))
      onSongUpdate(updated)
      setNewArr(primaryDefaults(updated))
    } catch (err: any) {
      setSaveError(err.response?.data?.error ?? 'Failed to add arrangement')
    } finally {
      setAddingArr(false)
    }
  }

  const handleDeleteArrangement = async (arr: Arrangement) => {
    if (!selectedSong) return
    if (!confirm(`Remove arrangement "${arr.name || arr.key_signature}"?`)) return
    try {
      await axios.delete(`/api/songs/arrangements/${arr.id}`)
      const updated = { ...selectedSong, arrangements: selectedSong.arrangements.filter(a => a.id !== arr.id) }
      setSelectedSong(updated)
      setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))
      onSongUpdate(updated)
    } catch (err: any) {
      setSaveError(err.response?.data?.error ?? 'Failed to delete arrangement')
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Song list */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-3 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search songs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
          <p className="text-xs text-gray-400 mt-1.5">{filtered.length} songs</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(song => {
            const primary = song.arrangements.find(a => a.is_primary) ?? song.arrangements[0]
            const isSelected = selectedSong?.id === song.id
            return (
              <button
                key={song.id}
                onClick={() => openEdit(song)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                  {song.title}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                  <span className="truncate">{song.artist}</span>
                  {primary && (
                    <span className="text-gray-400 flex-shrink-0">
                      {primary.key_signature} · {primary.tempo_bpm} BPM
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Edit panel */}
      <div className="flex-1 overflow-y-auto">
        {!selectedSong ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Select a song to edit
          </div>
        ) : editState ? (
          <div className="max-w-2xl mx-auto p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800">{selectedSong.title}</h2>
              <p className="text-sm text-gray-500">{selectedSong.artist} · {selectedSong.source_label}</p>
            </div>

            {/* Primary arrangement */}
            <section className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Primary Arrangement</h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="col-span-2 flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Arrangement Name <span className="text-gray-400 font-normal">(optional)</span></span>
                  <input
                    type="text"
                    placeholder={`e.g. Original (${selectedSong.artist})`}
                    value={editState.arrangementName}
                    onChange={e => setEditState(prev => prev ? { ...prev, arrangementName: e.target.value } : prev)}
                    className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Key</span>
                  <select
                    value={editState.key_signature}
                    onChange={e => setEditState(prev => prev ? { ...prev, key_signature: e.target.value } : prev)}
                    className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  >
                    {KEY_SIGNATURES.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Tempo (BPM)</span>
                  <input
                    type="number"
                    min={40}
                    max={220}
                    value={editState.tempo_bpm}
                    onChange={e => setEditState(prev => prev ? { ...prev, tempo_bpm: parseInt(e.target.value) || 0 } : prev)}
                    className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Time Signature</span>
                  <select
                    value={editState.time_signature}
                    onChange={e => setEditState(prev => prev ? { ...prev, time_signature: e.target.value } : prev)}
                    className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  >
                    {TIME_SIGNATURES.map(ts => <option key={ts} value={ts}>{ts}</option>)}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Energy Level (1–5)</span>
                  <div className="flex gap-1.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setEditState(prev => prev ? { ...prev, energy_level: n } : prev)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                          editState.energy_level === n
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
            </section>

            {/* Metadata */}
            <section className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Metadata</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Style</span>
                  <select
                    value={editState.style}
                    onChange={e => setEditState(prev => prev ? { ...prev, style: e.target.value } : prev)}
                    className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  >
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Theological Depth (1–3)</span>
                  <div className="flex gap-1.5 mt-0.5">
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        onClick={() => setEditState(prev => prev ? { ...prev, theological_depth: n } : prev)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                          editState.theological_depth === n
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editState.is_hymn}
                  onChange={e => setEditState(prev => prev ? { ...prev, is_hymn: e.target.checked } : prev)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Hymn
              </label>
            </section>

            {/* Themes */}
            <section className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Themes</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {editState.themes.map(theme => (
                  <span key={theme} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                    {theme}
                    <button onClick={() => removeTheme(theme)} className="hover:text-red-500 ml-0.5">✕</button>
                  </span>
                ))}
                {editState.themes.length === 0 && (
                  <span className="text-xs text-gray-400">No themes</span>
                )}
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Add theme..."
                  value={themeInput}
                  onChange={e => setThemeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTheme(themeInput)}
                  className="flex-1 border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={() => addTheme(themeInput)}
                  className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {COMMON_THEMES.filter(t => !editState.themes.includes(t)).map(t => (
                  <button
                    key={t}
                    onClick={() => addTheme(t)}
                    className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 px-1.5 py-0.5 rounded transition-colors"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </section>

            {/* Save */}
            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saveSuccess && <span className="text-sm text-green-600">Saved</span>}
              {saveError && <span className="text-sm text-red-500">{saveError}</span>}
            </div>

            {/* Alternate arrangements */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Alternate Arrangements</h3>
              <div className="flex flex-col gap-2 mb-4">
                {selectedSong.arrangements.filter(a => !a.is_primary).length === 0 && (
                  <p className="text-xs text-gray-400">No alternate arrangements</p>
                )}
                {selectedSong.arrangements.filter(a => !a.is_primary).map(arr => (
                  <div key={arr.id} className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                    <div className="flex-1 min-w-0">
                      {arr.name && <div className="text-sm font-medium text-gray-700 truncate">{arr.name}</div>}
                      <div className="text-xs text-gray-500">
                        {arr.key_signature} · {arr.tempo_bpm} BPM · {arr.time_signature} · Energy {arr.energy_level}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteArrangement(arr)}
                      className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new alternate */}
              <div className="border border-dashed border-gray-300 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Add alternate arrangement</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <label className="col-span-2 flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Name <span className="text-gray-400 font-normal">(optional)</span></span>
                    <input
                      type="text"
                      placeholder="e.g. Church key, Acoustic, Capo 2"
                      value={newArr.name}
                      onChange={e => setNewArr(prev => ({ ...prev, name: e.target.value }))}
                      className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Key</span>
                    <select
                      value={newArr.key_signature}
                      onChange={e => setNewArr(prev => ({ ...prev, key_signature: e.target.value }))}
                      className="border border-gray-200 rounded px-1.5 py-1 text-sm focus:outline-none focus:border-blue-400"
                    >
                      {KEY_SIGNATURES.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">BPM</span>
                    <input
                      type="number"
                      min={40}
                      max={220}
                      value={newArr.tempo_bpm}
                      onChange={e => setNewArr(prev => ({ ...prev, tempo_bpm: parseInt(e.target.value) || 0 }))}
                      className="border border-gray-200 rounded px-1.5 py-1 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Time</span>
                    <select
                      value={newArr.time_signature}
                      onChange={e => setNewArr(prev => ({ ...prev, time_signature: e.target.value }))}
                      className="border border-gray-200 rounded px-1.5 py-1 text-sm focus:outline-none focus:border-blue-400"
                    >
                      {TIME_SIGNATURES.map(ts => <option key={ts} value={ts}>{ts}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Energy</span>
                    <select
                      value={newArr.energy_level}
                      onChange={e => setNewArr(prev => ({ ...prev, energy_level: parseInt(e.target.value) }))}
                      className="border border-gray-200 rounded px-1.5 py-1 text-sm focus:outline-none focus:border-blue-400"
                    >
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </div>
                <button
                  onClick={handleAddArrangement}
                  disabled={addingArr}
                  className="text-xs px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50"
                >
                  {addingArr ? 'Adding…' : '+ Add arrangement'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
