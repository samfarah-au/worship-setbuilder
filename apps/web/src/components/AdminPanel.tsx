import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import type { Song, Arrangement, SpotifyCandidate, PcoPreviewItem, PcoImportResult } from '../types'

const KEY_SIGNATURES = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const KEY_TO_NUMBER: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11,
}
const BASE_TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '2/2', '12/8']
const BASE_STYLES = ['modern', 'hymn', 'gospel', 'folk-worship']
const COMMON_THEMES = [
  'praise', 'worship', 'grace', 'salvation', 'hope', 'faith', 'love',
  'surrender', 'holiness', 'presence', 'gratitude', 'redemption',
  'glory', 'victory', 'peace', 'joy', 'trinity', 'resurrection',
]

interface SettingsData {
  time_signatures: { base: string[]; custom: string[] }
  styles: { base: string[]; custom: string[] }
}

interface EditState {
  source_labels: string[]
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
  source_label: string
  key_signature: string
  tempo_bpm: number
  time_signature: string
  energy_level: number
}

interface Props {
  onSongUpdate: (song: Song) => void
  onSongAdd: (song: Song) => void
  onSongsReload: () => Promise<void>
}

type AdminView = 'songs' | 'add' | 'pco' | 'settings'

interface AddSongForm {
  title: string
  artist: string
  source_labels: string[]
  key_signature: string
  tempo_bpm: number
  time_signature: string
  energy_level: number
  themes: string[]
  theological_depth: number
  style: string
  is_hymn: boolean
  spotify_track_id: string
  album: string
  released_at: string
}

const fieldClass = 'bg-white border border-gray-300 rounded shadow-sm focus:outline-none focus:border-blue-400'

function bpmToEnergy(bpm: number): number {
  if (bpm < 65)  return 1
  if (bpm < 86)  return 2
  if (bpm < 111) return 3
  if (bpm < 131) return 4
  return 5
}

function BpmField({ bpm, onChange, size = 'md' }: { bpm: number; onChange: (bpm: number, energy: number) => void; size?: 'sm' | 'md' }) {
  const inputClass = size === 'sm' ? `px-1.5 py-1 text-sm ${fieldClass}` : `px-2 py-1.5 text-sm ${fieldClass}`
  const set = (val: number) => { const b = Math.max(40, Math.min(300, val)); onChange(b, bpmToEnergy(b)) }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <input type="number" min={40} max={300} value={bpm}
          onChange={e => set(parseInt(e.target.value) || 0)}
          className={`flex-1 min-w-0 ${inputClass}`} />
        {bpm <= 120 && (
          <button type="button" onClick={() => set(Math.round(bpm * 2))}
            className={`py-1.5 text-xs font-medium ${fieldClass} hover:bg-gray-50 px-2`}>×2</button>
        )}
      </div>
      {bpm >= 60 && bpm <= 95 && (
        <p className="text-xs text-amber-600">Could this be {bpm * 2} BPM?</p>
      )}
    </div>
  )
}

export default function AdminPanel({ onSongUpdate, onSongAdd, onSongsReload }: Props) {
  const [view, setView] = useState<AdminView>('songs')

  // Songs view state
  const [songs, setSongs] = useState<Song[]>([])
  const [search, setSearch] = useState('')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [themeInput, setThemeInput] = useState('')
  const [sourceLabelInput, setSourceLabelInput] = useState('')
  const [newArr, setNewArr] = useState<NewArrangement>({
    name: '', source_label: '', key_signature: 'G', tempo_bpm: 72, time_signature: '4/4', energy_level: 3,
  })
  const [addingArr, setAddingArr] = useState(false)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Settings view state
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [newTimeSig, setNewTimeSig] = useState('')
  const [newStyle, setNewStyle] = useState('')
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // Add Song view state
  const [addSearch, setAddSearch] = useState({ title: '', artist: '' })
  const [addSearching, setAddSearching] = useState(false)
  const [addCandidates, setAddCandidates] = useState<SpotifyCandidate[]>([])
  const [addSearchError, setAddSearchError] = useState<string | null>(null)
  const [addPicked, setAddPicked] = useState<SpotifyCandidate | null>(null)
  const [addForm, setAddForm] = useState<AddSongForm | null>(null)
  const [addSourceInput, setAddSourceInput] = useState('')
  const [addThemeInput, setAddThemeInput] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState<string | null>(null)

  // Arrangement inline edit state
  const [editingArrId, setEditingArrId] = useState<string | null>(null)
  const [editingArr, setEditingArr] = useState<{ name: string; source_label: string; key_signature: string; tempo_bpm: number; time_signature: string; energy_level: number } | null>(null)
  const [savingArr, setSavingArr] = useState(false)

  // PCO state
  const [pcoConfigData, setPcoConfigData] = useState<{ configured: boolean; appId: string; secret: string; pcoSongCount: number } | null>(null)
  const [pcoAppId, setPcoAppId] = useState('')
  const [pcoSecret, setPcoSecret] = useState('')
  const [pcoSaving, setPcoSaving] = useState(false)
  const [pcoConnError, setPcoConnError] = useState<string | null>(null)
  const [pcoPreview, setPcoPreview] = useState<PcoPreviewItem[] | null>(null)
  const [pcoLoading, setPcoLoading] = useState(false)
  const [pcoFilter, setPcoFilter] = useState<'all' | 'new' | 'match' | 'imported'>('all')
  const [selectedPcoIds, setSelectedPcoIds] = useState<Set<string>>(new Set())
  const [overwriteMetadata, setOverwriteMetadata] = useState(false)
  const [pcoImporting, setPcoImporting] = useState(false)
  const [pcoResult, setPcoResult] = useState<PcoImportResult | null>(null)

  // Derived full lists for dropdowns
  const allTimeSigs = settings
    ? [...settings.time_signatures.base, ...settings.time_signatures.custom]
    : BASE_TIME_SIGNATURES
  const allStyles = settings
    ? [...settings.styles.base, ...settings.styles.custom]
    : BASE_STYLES

  useEffect(() => {
    axios.get('/api/songs').then(res => setSongs(res.data)).catch(console.error)
    axios.get('/api/settings').then(res => setSettings(res.data)).catch(console.error)
  }, [])

  useEffect(() => {
    if (view !== 'pco' || pcoConfigData) return
    axios.get('/api/pco/config').then(res => {
      setPcoConfigData(res.data)
      setPcoAppId(res.data.appId)
      setPcoSecret(res.data.configured ? '' : res.data.secret)
    }).catch(console.error)
  }, [view])

  const filtered = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.artist.toLowerCase().includes(search.toLowerCase())
  )

  const primaryDefaults = (song: Song): NewArrangement => {
    const primary = song.arrangements.find(a => a.is_primary) ?? song.arrangements[0]
    return {
      name: '', source_label: '',
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
      source_labels:     [...song.source_labels],
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
    setSourceLabelInput('')
  }

  const handleSave = async () => {
    if (!selectedSong || !editState) return
    setSaving(true); setSaveError(null)
    try {
      const { data: updated } = await axios.patch(`/api/songs/${selectedSong.id}`, {
        source_labels:     editState.source_labels,
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
      })
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

  const addSourceLabel = (label: string) => {
    const l = label.trim()
    if (!l || editState!.source_labels.includes(l)) return
    setEditState(prev => prev ? { ...prev, source_labels: [...prev.source_labels, l] } : prev)
    setSourceLabelInput('')
  }

  const removeSourceLabel = (label: string) => {
    setEditState(prev => prev ? { ...prev, source_labels: prev.source_labels.filter(l => l !== label) } : prev)
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
    setAddingArr(true); setSaveError(null)
    try {
      const { data } = await axios.post(`/api/songs/${selectedSong.id}/arrangements`, {
        name:           newArr.name || null,
        source_label:   newArr.source_label || null,
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

  // Add Song handlers
  const searchSpotify = async () => {
    if (!addSearch.title.trim()) return
    setAddSearching(true); setAddSearchError(null); setAddCandidates([]); setAddPicked(null); setAddForm(null)
    try {
      const { data } = await axios.get('/api/songs/search', { params: { title: addSearch.title, artist: addSearch.artist } })
      setAddCandidates(data)
      if (!data.length) setAddSearchError('No results found on Spotify')
    } catch {
      setAddSearchError('Spotify search failed')
    } finally {
      setAddSearching(false)
    }
  }

  const pickCandidate = (c: SpotifyCandidate) => {
    setAddPicked(c)
    setAddError(null); setAddSuccess(null)
    setAddForm({
      title:             c.title,
      artist:            c.artist,
      album:             c.album,
      released_at:       c.releasedAt ? c.releasedAt.split('T')[0] : '',
      spotify_track_id:  c.spotifyTrackId,
      source_labels:     [],
      key_signature:     'G',
      tempo_bpm:         72,
      time_signature:    '4/4',
      energy_level:      bpmToEnergy(72),
      themes:            [],
      theological_depth: 2,
      style:             'modern',
      is_hymn:           false,
    })
    setAddSourceInput(''); setAddThemeInput('')
  }

  const handleAddSong = async () => {
    if (!addForm) return
    if (!addForm.source_labels.length) { setAddError('Add at least one source label'); return }
    setAddSaving(true); setAddError(null); setAddSuccess(null)
    try {
      const { data: created } = await axios.post('/api/songs', {
        ...addForm,
        key_number: KEY_TO_NUMBER[addForm.key_signature] ?? 0,
      })
      setSongs(prev => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)))
      onSongAdd(created)
      setAddSuccess(`"${created.title}" added to library`)
      setAddPicked(null); setAddForm(null); setAddCandidates([])
      setAddSearch({ title: '', artist: '' })
    } catch (err: any) {
      const msg = err.response?.data?.error ?? 'Save failed'
      if (err.response?.status === 409) {
        setAddError(msg)
      } else {
        setAddError(msg)
      }
    } finally {
      setAddSaving(false)
    }
  }

  // Arrangement inline edit handlers
  const startEditArr = (arr: Arrangement) => {
    setEditingArrId(arr.id)
    setEditingArr({ name: arr.name ?? '', source_label: arr.source_label ?? '', key_signature: arr.key_signature, tempo_bpm: arr.tempo_bpm, time_signature: arr.time_signature, energy_level: arr.energy_level })
  }

  const handleSaveArr = async () => {
    if (!selectedSong || !editingArrId || !editingArr) return
    setSavingArr(true)
    try {
      const { data } = await axios.patch(`/api/songs/arrangements/${editingArrId}`, {
        ...editingArr,
        key_number: KEY_TO_NUMBER[editingArr.key_signature] ?? 0,
      })
      const updated = { ...selectedSong, arrangements: selectedSong.arrangements.map(a => a.id === editingArrId ? { ...a, ...data } : a) }
      setSelectedSong(updated)
      setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))
      onSongUpdate(updated)
      setEditingArrId(null); setEditingArr(null)
    } catch (err: any) {
      setSaveError(err.response?.data?.error ?? 'Save failed')
    } finally {
      setSavingArr(false)
    }
  }

  // PCO handlers
  const savePcoConnection = async () => {
    if (!pcoAppId.trim() || !pcoSecret.trim()) { setPcoConnError('Both App ID and Secret are required'); return }
    setPcoSaving(true); setPcoConnError(null)
    try {
      const { data } = await axios.put('/api/pco/config', { app_id: pcoAppId, secret: pcoSecret })
      if (data.clearedCount > 0) {
        await onSongsReload()
      }
      const refreshed = await axios.get('/api/pco/config')
      setPcoConfigData(refreshed.data)
      setPcoSecret('')
      setPcoPreview(null); setPcoResult(null)
    } catch (err: any) {
      setPcoConnError(err.response?.data?.error ?? 'Connection failed')
    } finally {
      setPcoSaving(false)
    }
  }

  const resetPcoConnection = async () => {
    if (!confirm('This will remove the "Planning Center" label from all songs. Continue?')) return
    setPcoSaving(true)
    try {
      await axios.put('/api/pco/config', { reset: true })
      await onSongsReload()
      setPcoConfigData(prev => prev ? { ...prev, configured: false, pcoSongCount: 0 } : prev)
      setPcoPreview(null); setPcoResult(null)
    } finally {
      setPcoSaving(false)
    }
  }

  const loadPcoPreview = async () => {
    setPcoLoading(true); setPcoResult(null)
    try {
      const { data } = await axios.get('/api/pco/preview')
      setPcoPreview(data)
      setSelectedPcoIds(new Set(data.filter((i: PcoPreviewItem) => i.status !== 'imported').map((i: PcoPreviewItem) => i.pcoId)))
    } catch (err: any) {
      setPcoConnError(err.response?.data?.error ?? 'Preview failed')
    } finally {
      setPcoLoading(false)
    }
  }

  const runPcoImport = async () => {
    setPcoImporting(true); setPcoResult(null)
    try {
      const { data } = await axios.post('/api/pco/import', {
        pco_song_ids: [...selectedPcoIds],
        overwrite_metadata: overwriteMetadata,
      })
      setPcoResult(data)
      await onSongsReload()
      // Refresh preview to update statuses
      const preview = await axios.get('/api/pco/preview')
      setPcoPreview(preview.data)
      const refreshed = await axios.get('/api/pco/config')
      setPcoConfigData(refreshed.data)
    } catch (err: any) {
      setPcoConnError(err.response?.data?.error ?? 'Import failed')
    } finally {
      setPcoImporting(false)
    }
  }

  const togglePcoId = (id: string) => setSelectedPcoIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const filteredPreview = pcoPreview?.filter(i => pcoFilter === 'all' || i.status === pcoFilter) ?? []

  // Settings handlers
  const addTimeSig = async () => {
    const v = newTimeSig.trim()
    if (!v) return
    setSettingsError(null)
    try {
      await axios.post('/api/settings/time_signatures', { value: v })
      setSettings(prev => prev ? { ...prev, time_signatures: { ...prev.time_signatures, custom: [...prev.time_signatures.custom, v] } } : prev)
      setNewTimeSig('')
    } catch (err: any) {
      setSettingsError(err.response?.data?.error ?? 'Failed to add')
    }
  }

  const deleteTimeSig = async (value: string) => {
    setSettingsError(null)
    try {
      await axios.delete(`/api/settings/time_signatures/${encodeURIComponent(value)}`)
      setSettings(prev => prev ? { ...prev, time_signatures: { ...prev.time_signatures, custom: prev.time_signatures.custom.filter(v => v !== value) } } : prev)
    } catch (err: any) {
      setSettingsError(err.response?.data?.error ?? 'Failed to delete')
    }
  }

  const addStyle = async () => {
    const v = newStyle.trim()
    if (!v) return
    setSettingsError(null)
    try {
      await axios.post('/api/settings/styles', { value: v })
      setSettings(prev => prev ? { ...prev, styles: { ...prev.styles, custom: [...prev.styles.custom, v] } } : prev)
      setNewStyle('')
    } catch (err: any) {
      setSettingsError(err.response?.data?.error ?? 'Failed to add')
    }
  }

  const deleteStyle = async (value: string) => {
    setSettingsError(null)
    try {
      await axios.delete(`/api/settings/styles/${encodeURIComponent(value)}`)
      setSettings(prev => prev ? { ...prev, styles: { ...prev.styles, custom: prev.styles.custom.filter(v => v !== value) } } : prev)
    } catch (err: any) {
      setSettingsError(err.response?.data?.error ?? 'Failed to delete')
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: song list (songs view) or nav (settings view) */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        {/* Sub-nav */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setView('songs')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${view === 'songs' ? 'text-blue-600 border-b-2 border-blue-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Songs
          </button>
          <button
            onClick={() => setView('add')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${view === 'add' ? 'text-blue-600 border-b-2 border-blue-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
          >
            + Add
          </button>
          <button
            onClick={() => setView('pco')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${view === 'pco' ? 'text-blue-600 border-b-2 border-blue-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
          >
            PCO
          </button>
          <button
            onClick={() => setView('settings')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${view === 'settings' ? 'text-blue-600 border-b-2 border-blue-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Settings
          </button>
        </div>

        {view === 'songs' && (
          <>
            <div className="p-3 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search songs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`w-full px-2.5 py-1.5 text-sm ${fieldClass}`}
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
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                  >
                    <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>{song.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                      <span className="truncate">{song.artist}</span>
                      {primary && <span className="text-gray-400 flex-shrink-0">{primary.key_signature} · {primary.tempo_bpm} BPM</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {view === 'add' && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            <p className="text-xs text-gray-500">Search Spotify to find a song, then pick a version to add to the library.</p>
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                placeholder="Title"
                value={addSearch.title}
                onChange={e => setAddSearch(prev => ({ ...prev, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && searchSpotify()}
                className={`px-2.5 py-1.5 text-sm ${fieldClass}`}
              />
              <input
                type="text"
                placeholder="Artist (optional)"
                value={addSearch.artist}
                onChange={e => setAddSearch(prev => ({ ...prev, artist: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && searchSpotify()}
                className={`px-2.5 py-1.5 text-sm ${fieldClass}`}
              />
              <button
                onClick={searchSpotify}
                disabled={addSearching || !addSearch.title.trim()}
                className="text-xs px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50"
              >
                {addSearching ? 'Searching…' : 'Search Spotify'}
              </button>
            </div>

            {addSearchError && <p className="text-xs text-red-500">{addSearchError}</p>}

            {addCandidates.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Results</p>
                {addCandidates.map(c => (
                  <button
                    key={c.spotifyTrackId}
                    onClick={() => pickCandidate(c)}
                    className={`text-left px-2.5 py-2 rounded border text-xs transition-colors ${
                      addPicked?.spotifyTrackId === c.spotifyTrackId
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-800 truncate">{c.title}</div>
                    <div className="text-gray-500 truncate">{c.artist} · {c.album}</div>
                    <div className="text-gray-400">{c.releasedAt?.split('-')[0]}{c.isLive && ' · Live'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'pco' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Planning Center</h3>
              {pcoConfigData?.configured && (
                <p className="text-xs text-green-600 mb-3">Connected · {pcoConfigData.pcoSongCount} songs imported</p>
              )}
            </div>
            {pcoConnError && <p className="text-xs text-red-500">{pcoConnError}</p>}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">App ID</span>
              <input type="text" value={pcoAppId} onChange={e => setPcoAppId(e.target.value)} className={`px-2.5 py-1.5 text-xs ${fieldClass}`} placeholder="Personal Access Token App ID" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">Secret {pcoConfigData?.configured && <span className="text-gray-400">(leave blank to keep existing)</span>}</span>
              <input type="password" value={pcoSecret} onChange={e => setPcoSecret(e.target.value)} className={`px-2.5 py-1.5 text-xs ${fieldClass}`} placeholder={pcoConfigData?.configured ? '••••••••' : 'Personal Access Token Secret'} />
            </label>
            <div className="flex gap-2">
              <button onClick={savePcoConnection} disabled={pcoSaving} className="flex-1 text-xs py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50">
                {pcoSaving ? 'Connecting…' : 'Save Connection'}
              </button>
              {pcoConfigData?.configured && (
                <button onClick={resetPcoConnection} disabled={pcoSaving} className="text-xs px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 rounded disabled:opacity-50">
                  Reset
                </button>
              )}
            </div>
            {pcoConfigData?.configured && (
              <button onClick={loadPcoPreview} disabled={pcoLoading} className="text-xs py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {pcoLoading ? 'Loading…' : 'Load PCO Library'}
              </button>
            )}
          </div>
        )}

        {view === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            {settingsError && <p className="text-xs text-red-500">{settingsError}</p>}

            {/* Time Signatures */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Time Signatures</h3>
              <div className="flex flex-col gap-1 mb-3">
                {settings?.time_signatures.base.map(v => (
                  <div key={v} className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                    <span>{v}</span>
                    <span className="text-gray-300 text-xs">base</span>
                  </div>
                ))}
                {settings?.time_signatures.custom.map(v => (
                  <div key={v} className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-700">
                    <span>{v}</span>
                    <button onClick={() => deleteTimeSig(v)} className="text-gray-400 hover:text-red-500">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. 5/4"
                  value={newTimeSig}
                  onChange={e => setNewTimeSig(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTimeSig()}
                  className={`flex-1 px-2 py-1 text-xs ${fieldClass}`}
                />
                <button onClick={addTimeSig} className="text-xs px-2.5 py-1 bg-gray-700 text-white rounded hover:bg-gray-800">Add</button>
              </div>
            </div>

            {/* Styles */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Styles</h3>
              <div className="flex flex-col gap-1 mb-3">
                {settings?.styles.base.map(v => (
                  <div key={v} className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                    <span>{v}</span>
                    <span className="text-gray-300 text-xs">base</span>
                  </div>
                ))}
                {settings?.styles.custom.map(v => (
                  <div key={v} className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-700">
                    <span>{v}</span>
                    <button onClick={() => deleteStyle(v)} className="text-gray-400 hover:text-red-500">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. contemporary"
                  value={newStyle}
                  onChange={e => setNewStyle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addStyle()}
                  className={`flex-1 px-2 py-1 text-xs ${fieldClass}`}
                />
                <button onClick={addStyle} className="text-xs px-2.5 py-1 bg-gray-700 text-white rounded hover:bg-gray-800">Add</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: edit panel */}
      <div className="flex-1 overflow-y-auto">
        {view === 'pco' ? (
          !pcoPreview ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              {pcoLoading ? 'Loading PCO library…' : pcoConfigData?.configured ? 'Click "Load PCO Library" to preview songs' : 'Configure your PCO connection on the left'}
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Summary + controls */}
              <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
                <div className="flex gap-3 text-xs">
                  {(['all', 'new', 'match', 'imported'] as const).map(f => {
                    const count = f === 'all' ? pcoPreview.length : pcoPreview.filter(i => i.status === f).length
                    return (
                      <button key={f} onClick={() => setPcoFilter(f)}
                        className={`px-2.5 py-1 rounded border transition-colors ${pcoFilter === f ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                        {f === 'all' ? 'All' : f === 'new' ? 'New' : f === 'match' ? 'Matched' : 'Imported'} ({count})
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={overwriteMetadata} onChange={e => setOverwriteMetadata(e.target.checked)} className="w-3.5 h-3.5" />
                    Overwrite BPM/key/time sig
                  </label>
                  <button onClick={runPcoImport} disabled={pcoImporting || selectedPcoIds.size === 0}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                    {pcoImporting ? 'Importing…' : `Import ${selectedPcoIds.size} selected`}
                  </button>
                </div>
              </div>
              {pcoResult && (
                <div className="px-4 py-2 bg-green-50 border-b border-green-200 text-xs text-green-700 flex gap-4">
                  <span>{pcoResult.added} added</span>
                  <span>{pcoResult.matched} matched</span>
                  <span>{pcoResult.skipped} skipped</span>
                  {pcoResult.errors.length > 0 && <span className="text-red-600">{pcoResult.errors.length} errors</span>}
                </div>
              )}
              {/* Song list */}
              <div className="flex-1 overflow-y-auto">
                {filteredPreview.map(item => (
                  <div key={item.pcoId} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50">
                    <input type="checkbox" checked={selectedPcoIds.has(item.pcoId)} onChange={() => togglePcoId(item.pcoId)}
                      disabled={item.status === 'imported'}
                      className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{item.title}</div>
                      <div className="text-xs text-gray-500 truncate">{item.author}{item.ccliNumber ? ` · CCLI ${item.ccliNumber}` : ''}</div>
                      {item.status === 'match' && (
                        <div className="text-xs text-amber-600">Matches: {item.existingTitle} <span className="text-gray-400">via {item.matchedBy}</span></div>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                      item.status === 'new' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      item.status === 'match' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : view === 'add' ? (
          !addForm ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              {addSuccess
                ? <span className="text-green-600">{addSuccess}</span>
                : 'Search and pick a Spotify result to continue'}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800">{addForm.title}</h2>
                <p className="text-sm text-gray-500">{addForm.artist}{addForm.album ? ` · ${addForm.album}` : ''}{addForm.released_at ? ` · ${addForm.released_at.split('-')[0]}` : ''}</p>
              </div>

              {/* Source Labels */}
              <section className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Source Labels</h3>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {addForm.source_labels.map(l => (
                    <span key={l} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                      {l}
                      <button onClick={() => setAddForm(prev => prev ? { ...prev, source_labels: prev.source_labels.filter(x => x !== l) } : prev)} className="hover:text-red-500 ml-0.5">✕</button>
                    </span>
                  ))}
                  {addForm.source_labels.length === 0 && <span className="text-xs text-gray-400">No source labels</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add source label..."
                    value={addSourceInput}
                    onChange={e => setAddSourceInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const l = addSourceInput.trim()
                        if (l && !addForm.source_labels.includes(l)) setAddForm(prev => prev ? { ...prev, source_labels: [...prev.source_labels, l] } : prev)
                        setAddSourceInput('')
                      }
                    }}
                    className={`flex-1 px-2.5 py-1.5 text-sm ${fieldClass}`}
                  />
                  <button
                    onClick={() => {
                      const l = addSourceInput.trim()
                      if (l && !addForm.source_labels.includes(l)) setAddForm(prev => prev ? { ...prev, source_labels: [...prev.source_labels, l] } : prev)
                      setAddSourceInput('')
                    }}
                    className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                  >Add</button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {[...new Set(songs.flatMap(s => s.source_labels))].sort()
                    .filter(l => !addForm.source_labels.includes(l))
                    .map(l => (
                      <button key={l} onClick={() => setAddForm(prev => prev ? { ...prev, source_labels: [...prev.source_labels, l] } : prev)} className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 px-1.5 py-0.5 rounded transition-colors">+ {l}</button>
                    ))}
                </div>
              </section>

              {/* Arrangement */}
              <section className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Arrangement</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Key</span>
                    <select value={addForm.key_signature} onChange={e => setAddForm(prev => prev ? { ...prev, key_signature: e.target.value } : prev)} className={`px-2 py-1.5 text-sm ${fieldClass}`}>
                      {KEY_SIGNATURES.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Tempo (BPM)</span>
                    <BpmField bpm={addForm.tempo_bpm} onChange={(b, e) => setAddForm(prev => prev ? { ...prev, tempo_bpm: b, energy_level: e } : prev)} />
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Time Signature</span>
                    <select value={addForm.time_signature} onChange={e => setAddForm(prev => prev ? { ...prev, time_signature: e.target.value } : prev)} className={`px-2 py-1.5 text-sm ${fieldClass}`}>
                      {allTimeSigs.map(ts => <option key={ts} value={ts}>{ts}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Energy Level (1–5)</span>
                    <div className="flex gap-1.5 mt-0.5">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setAddForm(prev => prev ? { ...prev, energy_level: n } : prev)}
                          className={`w-8 h-8 rounded text-sm font-medium transition-colors ${addForm.energy_level === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
                    <select value={addForm.style} onChange={e => setAddForm(prev => prev ? { ...prev, style: e.target.value } : prev)} className={`px-2 py-1.5 text-sm ${fieldClass}`}>
                      {allStyles.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Theological Depth (1–3)</span>
                    <div className="flex gap-1.5 mt-0.5">
                      {[1,2,3].map(n => (
                        <button key={n} onClick={() => setAddForm(prev => prev ? { ...prev, theological_depth: n } : prev)}
                          className={`w-8 h-8 rounded text-sm font-medium transition-colors ${addForm.theological_depth === n ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input type="checkbox" checked={addForm.is_hymn} onChange={e => setAddForm(prev => prev ? { ...prev, is_hymn: e.target.checked } : prev)} className="w-4 h-4 rounded border-gray-300" />
                  Hymn
                </label>
              </section>

              {/* Themes */}
              <section className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Themes</h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {addForm.themes.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                      {t}
                      <button onClick={() => setAddForm(prev => prev ? { ...prev, themes: prev.themes.filter(x => x !== t) } : prev)} className="hover:text-red-500 ml-0.5">✕</button>
                    </span>
                  ))}
                  {addForm.themes.length === 0 && <span className="text-xs text-gray-400">No themes</span>}
                </div>
                <div className="flex gap-2 mb-2">
                  <input type="text" placeholder="Add theme..." value={addThemeInput} onChange={e => setAddThemeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const t = addThemeInput.trim().toLowerCase()
                        if (t && !addForm.themes.includes(t)) setAddForm(prev => prev ? { ...prev, themes: [...prev.themes, t] } : prev)
                        setAddThemeInput('')
                      }
                    }}
                    className={`flex-1 px-2.5 py-1.5 text-sm ${fieldClass}`} />
                  <button onClick={() => {
                    const t = addThemeInput.trim().toLowerCase()
                    if (t && !addForm.themes.includes(t)) setAddForm(prev => prev ? { ...prev, themes: [...prev.themes, t] } : prev)
                    setAddThemeInput('')
                  }} className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">Add</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {COMMON_THEMES.filter(t => !addForm.themes.includes(t)).map(t => (
                    <button key={t} onClick={() => setAddForm(prev => prev ? { ...prev, themes: [...prev.themes, t] } : prev)} className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 px-1.5 py-0.5 rounded transition-colors">+ {t}</button>
                  ))}
                </div>
              </section>

              <div className="flex items-center gap-3">
                <button onClick={handleAddSong} disabled={addSaving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                  {addSaving ? 'Adding…' : 'Add to library'}
                </button>
                <button onClick={() => { setAddForm(null); setAddPicked(null) }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                {addError && <span className="text-sm text-red-500">{addError}</span>}
              </div>
            </div>
          )
        ) : view === 'settings' ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Select a setting category on the left to manage values
          </div>
        ) : !selectedSong ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Select a song to edit
          </div>
        ) : editState ? (
          <div className="max-w-2xl mx-auto p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800">{selectedSong.title}</h2>
              <p className="text-sm text-gray-500">{selectedSong.artist}</p>
            </div>

            {/* Source Labels */}
            <section className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Source Labels</h3>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editState.source_labels.map(label => (
                  <span key={label} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                    {label}
                    <button onClick={() => removeSourceLabel(label)} className="hover:text-red-500 ml-0.5">✕</button>
                  </span>
                ))}
                {editState.source_labels.length === 0 && <span className="text-xs text-gray-400">No source labels</span>}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add source label..."
                  value={sourceLabelInput}
                  onChange={e => setSourceLabelInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSourceLabel(sourceLabelInput)}
                  className={`flex-1 px-2.5 py-1.5 text-sm ${fieldClass}`}
                />
                <button onClick={() => addSourceLabel(sourceLabelInput)} className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">Add</button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {[...new Set(songs.flatMap(s => s.source_labels))].sort()
                  .filter(l => !editState.source_labels.includes(l))
                  .map(l => (
                    <button key={l} onClick={() => addSourceLabel(l)} className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 px-1.5 py-0.5 rounded transition-colors">+ {l}</button>
                  ))}
              </div>
            </section>

            {/* Primary Arrangement */}
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
                    className={`px-2 py-1.5 text-sm ${fieldClass}`}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Key</span>
                  <select value={editState.key_signature} onChange={e => setEditState(prev => prev ? { ...prev, key_signature: e.target.value } : prev)} className={`px-2 py-1.5 text-sm ${fieldClass}`}>
                    {KEY_SIGNATURES.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Tempo (BPM)</span>
                  <BpmField bpm={editState.tempo_bpm} onChange={(b, e) => setEditState(prev => prev ? { ...prev, tempo_bpm: b, energy_level: e } : prev)} />
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Time Signature</span>
                  <select value={editState.time_signature} onChange={e => setEditState(prev => prev ? { ...prev, time_signature: e.target.value } : prev)} className={`px-2 py-1.5 text-sm ${fieldClass}`}>
                    {allTimeSigs.map(ts => <option key={ts} value={ts}>{ts}</option>)}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Energy Level (1–5)</span>
                  <div className="flex gap-1.5 mt-0.5">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setEditState(prev => prev ? { ...prev, energy_level: n } : prev)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${editState.energy_level === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
                  <select value={editState.style} onChange={e => setEditState(prev => prev ? { ...prev, style: e.target.value } : prev)} className={`px-2 py-1.5 text-sm ${fieldClass}`}>
                    {allStyles.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Theological Depth (1–3)</span>
                  <div className="flex gap-1.5 mt-0.5">
                    {[1,2,3].map(n => (
                      <button key={n} onClick={() => setEditState(prev => prev ? { ...prev, theological_depth: n } : prev)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${editState.theological_depth === n ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={editState.is_hymn} onChange={e => setEditState(prev => prev ? { ...prev, is_hymn: e.target.checked } : prev)} className="w-4 h-4 rounded border-gray-300" />
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
                {editState.themes.length === 0 && <span className="text-xs text-gray-400">No themes</span>}
              </div>
              <div className="flex gap-2 mb-2">
                <input type="text" placeholder="Add theme..." value={themeInput} onChange={e => setThemeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTheme(themeInput)} className={`flex-1 px-2.5 py-1.5 text-sm ${fieldClass}`} />
                <button onClick={() => addTheme(themeInput)} className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">Add</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {COMMON_THEMES.filter(t => !editState.themes.includes(t)).map(t => (
                  <button key={t} onClick={() => addTheme(t)} className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 px-1.5 py-0.5 rounded transition-colors">+ {t}</button>
                ))}
              </div>
            </section>

            {/* Save */}
            <div className="flex items-center gap-3 mb-8">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saveSuccess && <span className="text-sm text-green-600">Saved</span>}
              {saveError && <span className="text-sm text-red-500">{saveError}</span>}
            </div>

            {/* Alternate Arrangements */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Alternate Arrangements</h3>
              <div className="flex flex-col gap-2 mb-4">
                {selectedSong.arrangements.filter(a => !a.is_primary).length === 0 && (
                  <p className="text-xs text-gray-400">No alternate arrangements</p>
                )}
                {selectedSong.arrangements.filter(a => !a.is_primary).map(arr => (
                  <div key={arr.id} className="border border-gray-200 rounded-lg bg-gray-50">
                    {editingArrId === arr.id && editingArr ? (
                      <div className="p-3">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <label className="col-span-2 flex flex-col gap-1">
                            <span className="text-xs text-gray-500">Name</span>
                            <input type="text" value={editingArr.name} onChange={e => setEditingArr(prev => prev ? { ...prev, name: e.target.value } : prev)} className={`px-2 py-1 text-sm ${fieldClass}`} />
                          </label>
                          <label className="col-span-2 flex flex-col gap-1">
                            <span className="text-xs text-gray-500">Source Label</span>
                            <input type="text" value={editingArr.source_label} onChange={e => setEditingArr(prev => prev ? { ...prev, source_label: e.target.value } : prev)} className={`px-2 py-1 text-sm ${fieldClass}`} />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">Key</span>
                            <select value={editingArr.key_signature} onChange={e => setEditingArr(prev => prev ? { ...prev, key_signature: e.target.value } : prev)} className={`px-1.5 py-1 text-sm ${fieldClass}`}>
                              {KEY_SIGNATURES.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </label>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">BPM</span>
                            <BpmField bpm={editingArr.tempo_bpm} size="sm" onChange={(b, e) => setEditingArr(prev => prev ? { ...prev, tempo_bpm: b, energy_level: e } : prev)} />
                          </div>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">Time</span>
                            <select value={editingArr.time_signature} onChange={e => setEditingArr(prev => prev ? { ...prev, time_signature: e.target.value } : prev)} className={`px-1.5 py-1 text-sm ${fieldClass}`}>
                              {allTimeSigs.map(ts => <option key={ts} value={ts}>{ts}</option>)}
                            </select>
                          </label>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">Energy</span>
                            <div className="flex gap-1 mt-0.5">
                              {[1,2,3,4,5].map(n => (
                                <button key={n} type="button" onClick={() => setEditingArr(prev => prev ? { ...prev, energy_level: n } : prev)}
                                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${editingArr.energy_level === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{n}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleSaveArr} disabled={savingArr} className="text-xs px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50">{savingArr ? 'Saving…' : 'Save'}</button>
                          <button onClick={() => { setEditingArrId(null); setEditingArr(null) }} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          {arr.name && <div className="text-sm font-medium text-gray-700 truncate">{arr.name}</div>}
                          <div className="text-xs text-gray-500">
                            {arr.source_label && <span className="mr-1.5 bg-gray-200 text-gray-600 px-1 rounded">{arr.source_label}</span>}
                            {arr.key_signature} · {arr.tempo_bpm} BPM · {arr.time_signature} · Energy {arr.energy_level}
                          </div>
                        </div>
                        <button onClick={() => startEditArr(arr)} className="text-xs text-gray-400 hover:text-blue-600 flex-shrink-0">Edit</button>
                        <button onClick={() => handleDeleteArrangement(arr)} className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0">Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add alternate */}
              <div className="border border-dashed border-gray-300 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Add alternate arrangement</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <label className="col-span-2 flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Name <span className="text-gray-400 font-normal">(optional)</span></span>
                    <input type="text" placeholder="e.g. Church key, Acoustic, Capo 2" value={newArr.name} onChange={e => setNewArr(prev => ({ ...prev, name: e.target.value }))} className={`px-2 py-1.5 text-sm ${fieldClass}`} />
                  </label>
                  <div className="col-span-2 flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Source Label <span className="text-gray-400 font-normal">(optional — if from a different publisher)</span></span>
                    <input type="text" placeholder="e.g. Elevation" value={newArr.source_label} onChange={e => setNewArr(prev => ({ ...prev, source_label: e.target.value }))} className={`px-2 py-1.5 text-sm ${fieldClass}`} />
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {[...new Set(songs.flatMap(s => s.source_labels))].sort()
                        .filter(l => l !== newArr.source_label)
                        .map(l => (
                          <button key={l} type="button" onClick={() => setNewArr(prev => ({ ...prev, source_label: l }))} className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 px-1.5 py-0.5 rounded transition-colors">{l}</button>
                        ))}
                    </div>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Key</span>
                    <select value={newArr.key_signature} onChange={e => setNewArr(prev => ({ ...prev, key_signature: e.target.value }))} className={`px-1.5 py-1 text-sm ${fieldClass}`}>
                      {KEY_SIGNATURES.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">BPM</span>
                    <BpmField bpm={newArr.tempo_bpm} size="sm" onChange={(b, e) => setNewArr(prev => ({ ...prev, tempo_bpm: b, energy_level: e }))} />
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Time</span>
                    <select value={newArr.time_signature} onChange={e => setNewArr(prev => ({ ...prev, time_signature: e.target.value }))} className={`px-1.5 py-1 text-sm ${fieldClass}`}>
                      {allTimeSigs.map(ts => <option key={ts} value={ts}>{ts}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Energy</span>
                    <div className="flex gap-1 mt-0.5">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button" onClick={() => setNewArr(prev => ({ ...prev, energy_level: n }))}
                          className={`w-7 h-7 rounded text-xs font-medium transition-colors ${newArr.energy_level === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={handleAddArrangement} disabled={addingArr} className="text-xs px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50">
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
