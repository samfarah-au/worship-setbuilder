import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import type { Song, Arrangement, SpotifyCandidate, PcoPreviewItem, PcoImportResult } from '../types'
import SpotifyPreview from './SpotifyPreview'
import HelpBanner from './HelpBanner'

const KEY_SIGNATURES = [
  'A', 'Am', 'Bb', 'Bbm', 'B', 'Bm', 'C', 'Cm', 'C#', 'C#m', 'Db',
  'D', 'Dm', 'Eb', 'Ebm', 'E', 'Em', 'F', 'Fm', 'F#', 'F#m', 'Gb',
  'G', 'Gm', 'Ab', 'Abm',
]
const KEY_TO_NUMBER: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11,
  'Cm': 0, 'C#m': 1, 'Dm': 2, 'Ebm': 3, 'Em': 4,
  'Fm': 5, 'F#m': 6, 'Gm': 7, 'Abm': 8, 'Am': 9, 'Bbm': 10, 'Bm': 11,
}
const BASE_TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '2/2', '12/8']
const BASE_STYLES = ['modern', 'hymn', 'gospel', 'folk-worship']

interface SettingsData {
  time_signatures: { base: string[]; custom: string[] }
  styles: { base: string[]; custom: string[] }
  source_labels: string[]
  themes: string[]
}

interface EditState {
  title: string
  artist: string
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
  onLabelRename: (from: string, to: string) => void
  openSongId?: string | null
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

function inferSourceLabel(candidates: string[], knownLabels: string[]): string | null {
  let best: string | null = null
  for (const text of candidates) {
    if (!text) continue
    const lower = text.toLowerCase()
    for (const label of knownLabels) {
      if (label && lower.includes(label.toLowerCase())) {
        if (!best || label.length > best.length) best = label
      }
    }
  }
  return best
}

function bpmToEnergy(bpm: number, timeSignature = '4/4'): number {
  // Compound meters (6/8, 12/8): the beat is a dotted quarter = 1.5 quarter notes,
  // so the felt tempo is the written BPM divided by 1.5.
  const feltBpm = (timeSignature === '6/8' || timeSignature === '12/8') ? bpm / 1.5 : bpm
  if (feltBpm < 65)  return 1
  if (feltBpm < 86)  return 2
  if (feltBpm < 111) return 3
  if (feltBpm < 131) return 4
  return 5
}

function BpmField({ bpm, timeSignature = '4/4', onChange, size = 'md' }: { bpm: number; timeSignature?: string; onChange: (bpm: number, energy: number) => void; size?: 'sm' | 'md' }) {
  const [raw, setRaw] = useState(String(bpm))
  useEffect(() => { setRaw(String(bpm)) }, [bpm])

  const inputClass = size === 'sm' ? `px-1.5 py-1 text-sm ${fieldClass}` : `px-2 py-1.5 text-sm ${fieldClass}`

  const commit = (val: string) => {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n > 0) {
      const b = Math.max(40, Math.min(300, n))
      onChange(b, bpmToEnergy(b, timeSignature))
      setRaw(String(b))
    } else {
      setRaw(String(bpm))
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && commit(raw)}
          className={`flex-1 min-w-0 ${inputClass}`}
        />
        {bpm <= 120 && (
          <button type="button" onClick={() => { const b = Math.round(bpm * 2); onChange(Math.min(300, b), bpmToEnergy(Math.min(300, b), timeSignature)) }}
            className={`py-1.5 text-xs font-medium ${fieldClass} hover:bg-gray-50 px-2`}>×2</button>
        )}
      </div>
      {bpm >= 60 && bpm <= 95 && (
        <p className="text-xs text-amber-600">Could this be {bpm * 2} BPM?</p>
      )}
    </div>
  )
}

export default function AdminPanel({ onSongUpdate, onSongAdd, onSongsReload, onLabelRename, openSongId }: Props) {
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
  const [settingsCategory, setSettingsCategory] = useState<'source_labels' | 'themes' | 'time_signatures' | 'styles'>('source_labels')
  const [newTimeSig, setNewTimeSig] = useState('')
  const [newStyle, setNewStyle] = useState('')
  const [newSourceLabel, setNewSourceLabel] = useState('')
  const [newTheme, setNewTheme] = useState('')
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null)

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
  const [addDuplicates, setAddDuplicates] = useState<Song[]>([])

  // Arrangement inline edit state
  const [editingArrId, setEditingArrId] = useState<string | null>(null)
  const [editingArr, setEditingArr] = useState<{ name: string; source_label: string; key_signature: string; tempo_bpm: number; time_signature: string; energy_level: number } | null>(null)
  const [savingArr, setSavingArr] = useState(false)

  // PCO state
  const [pcoConfigData, setPcoConfigData] = useState<{ configured: boolean; appId: string; secret: string; pcoSongCount: number; serviceTypeId: string | null } | null>(null)
  const [pcoAppId, setPcoAppId] = useState('')
  const [pcoSecret, setPcoSecret] = useState('')
  const [pcoSaving, setPcoSaving] = useState(false)
  const [pcoConnError, setPcoConnError] = useState<string | null>(null)
  const [pcoSaveSuccess, setPcoSaveSuccess] = useState(false)
  const [pcoPreview, setPcoPreview] = useState<PcoPreviewItem[] | null>(null)
  const [pcoLoading, setPcoLoading] = useState(false)
  const [pcoFilter, setPcoFilter] = useState<'all' | 'new' | 'match' | 'imported' | 'archived'>('all')
  const [selectedPcoIds, setSelectedPcoIds] = useState<Set<string>>(new Set())
  const [overwriteMetadata, setOverwriteMetadata] = useState(false)
  const [pcoImporting, setPcoImporting] = useState(false)
  const [pcoProgress, setPcoProgress] = useState<{ done: number; total: number } | null>(null)
  const [pcoResult, setPcoResult] = useState<PcoImportResult | null>(null)
  const [pcoServiceTypes, setPcoServiceTypes] = useState<{ id: string; name: string }[] | null>(null)
  const [pcoServiceTypeSaving, setPcoServiceTypeSaving] = useState(false)
  const [pcoScheduleSyncing, setPcoScheduleSyncing] = useState(false)
  const [pcoScheduleSyncResult, setPcoScheduleSyncResult] = useState<string | null>(null)

  // Bulk select / delete / label (songs view)
  const [showUnlabeled, setShowUnlabeled] = useState(false)
  const [showRetired, setShowRetired] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
  const [bulkLabelValue, setBulkLabelValue] = useState('')
  const [bulkLabelApplying, setBulkLabelApplying] = useState(false)
  const [bulkLabelError, setBulkLabelError] = useState<string | null>(null)
  const [bulkLabelSuccess, setBulkLabelSuccess] = useState<string | null>(null)
  // Inline title/artist editing
  const [editingField, setEditingField] = useState<'title' | 'artist' | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingField, setSavingField] = useState(false)
  // Single song delete
  const [deletingSong, setDeletingSong] = useState(false)
  // Source label rename (settings view)
  const [renamingLabel, setRenamingLabel] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renameSaving, setRenameSaving] = useState(false)

  // Derived full lists for dropdowns
  const allTimeSigs = settings
    ? [...settings.time_signatures.base, ...settings.time_signatures.custom]
    : BASE_TIME_SIGNATURES
  const allStyles = settings
    ? [...settings.styles.base, ...settings.styles.custom]
    : BASE_STYLES

  useEffect(() => {
    axios.get('/api/songs', { params: { include_retired: 'true' } }).then(res => {
      setSongs(res.data)
      if (openSongId) {
        const song = (res.data as Song[]).find(s => s.id === openSongId)
        if (song) openEdit(song)
      }
    }).catch(console.error)
    axios.get('/api/settings').then(res => setSettings(res.data)).catch(console.error)
  }, [])

  useEffect(() => {
    if (view !== 'pco' || pcoConfigData) return
    axios.get('/api/pco/config').then(res => {
      setPcoConfigData(res.data)
      setPcoAppId(res.data.appId)
      setPcoSecret(res.data.configured ? '' : res.data.secret)
      if (res.data.appId) {
        axios.get('/api/pco/service-types')
          .then(r => setPcoServiceTypes(r.data))
          .catch(() => setPcoServiceTypes([]))
      }
    }).catch(console.error)
  }, [view])

  const filtered = songs
    .filter(s =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase())
    )
    .filter(s => !showUnlabeled || s.source_labels.length === 0)
    .filter(s => showRetired ? s.is_retired : !s.is_retired)

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
      title:             song.title,
      artist:            song.artist,
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
    setEditingField(null)
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
    const titleLower = c.title.toLowerCase()
    setAddDuplicates(songs.filter(s => s.title.toLowerCase() === titleLower))
    const inferredLabel = inferSourceLabel([c.title, c.artist, c.album], allSourceLabels)
    setAddForm({
      title:             c.title,
      artist:            c.artist,
      album:             c.album,
      released_at:       c.releasedAt ? c.releasedAt.split('T')[0] : '',
      spotify_track_id:  c.spotifyTrackId,
      source_labels:     inferredLabel ? [inferredLabel] : [],
      key_signature:     'C',
      tempo_bpm:         120,
      time_signature:    '4/4',
      energy_level:      bpmToEnergy(120),
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
      setAddPicked(null); setAddForm(null); setAddCandidates([]); setAddDuplicates([])
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
    if (!pcoAppId.trim()) { setPcoConnError('App ID is required'); return }
    if (!pcoSecret.trim() && !pcoConfigData?.configured) { setPcoConnError('Secret is required'); return }
    setPcoSaving(true); setPcoConnError(null); setPcoSaveSuccess(false)
    try {
      const body: Record<string, string> = { app_id: pcoAppId }
      if (pcoSecret.trim()) body.secret = pcoSecret
      const { data } = await axios.put('/api/pco/config', body)
      if (data.clearedCount > 0) {
        await onSongsReload()
      }
      const refreshed = await axios.get('/api/pco/config')
      setPcoConfigData(refreshed.data)
      setPcoSecret('')
      setPcoPreview(null); setPcoResult(null)
      setPcoSaveSuccess(true)
      setTimeout(() => setPcoSaveSuccess(false), 3000)
      if (refreshed.data.appId) {
        axios.get('/api/pco/service-types')
          .then(r => setPcoServiceTypes(r.data))
          .catch(() => setPcoServiceTypes([]))
      }
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
      setSelectedPcoIds(new Set(data.filter((i: PcoPreviewItem) => !i.hidden && i.status !== 'imported').map((i: PcoPreviewItem) => i.pcoId)))
    } catch (err: any) {
      setPcoConnError(err.response?.data?.error ?? 'Preview failed')
    } finally {
      setPcoLoading(false)
    }
  }

  const runPcoImport = async () => {
    const ids = [...selectedPcoIds]
    const BATCH = 10
    setPcoImporting(true); setPcoResult(null); setPcoProgress({ done: 0, total: ids.length })
    const totals: PcoImportResult = { added: 0, matched: 0, skipped: 0, errors: [] }
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH)
        const { data } = await axios.post('/api/pco/import', {
          pco_song_ids: batch,
          overwrite_metadata: overwriteMetadata,
        })
        totals.added   += data.added
        totals.matched += data.matched
        totals.skipped += data.skipped
        totals.errors.push(...(data.errors ?? []))
        setPcoProgress({ done: Math.min(i + BATCH, ids.length), total: ids.length })
      }
      setPcoResult(totals)
      await onSongsReload()
      const [songsRes, preview, refreshed] = await Promise.all([
        axios.get('/api/songs', { params: { include_retired: 'true' } }),
        axios.get('/api/pco/preview'),
        axios.get('/api/pco/config'),
      ])
      setSongs(songsRes.data)
      setSelectedSong(prev => prev ? (songsRes.data.find((s: Song) => s.id === prev.id) ?? prev) : null)
      setPcoPreview(preview.data)
      setPcoConfigData(refreshed.data)
    } catch (err: any) {
      setPcoConnError(err.response?.data?.error ?? 'Import failed')
    } finally {
      setPcoImporting(false); setPcoProgress(null)
    }
  }

  const saveField = async () => {
    if (!selectedSong || !editingField) return
    const value = editingValue.trim()
    if (!value) return
    setSavingField(true)
    try {
      const { data: updated } = await axios.patch(`/api/songs/${selectedSong.id}`, { [editingField]: value })
      setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))
      setSelectedSong(updated)
      setEditState(prev => prev ? { ...prev, [editingField]: value } : prev)
      onSongUpdate(updated)
      setEditingField(null)
    } catch (err: any) {
      setSaveError(err.response?.data?.error ?? 'Save failed')
    } finally {
      setSavingField(false)
    }
  }

  const handleRetireSong = async () => {
    if (!selectedSong) return
    const newRetired = !selectedSong.is_retired
    try {
      const { data } = await axios.patch(`/api/songs/${selectedSong.id}`, { is_retired: newRetired })
      setSongs(prev => prev.map(s => s.id === selectedSong.id ? data : s))
      setSelectedSong(data)
      onSongsReload()
    } catch (err: any) {
      setSaveError(err.response?.data?.error ?? 'Failed to update song')
    }
  }

  const handleDeleteSong = async () => {
    if (!selectedSong) return
    if (!confirm(`Permanently delete "${selectedSong.title}"? This cannot be undone.`)) return
    setDeletingSong(true); setSaveError(null)
    try {
      await axios.delete(`/api/songs/${selectedSong.id}`)
      const id = selectedSong.id
      setSongs(prev => prev.filter(s => s.id !== id))
      onSongsReload()
      setSelectedSong(null); setEditState(null)
    } catch (err: any) {
      setSaveError(err.response?.data?.error ?? 'Delete failed')
    } finally {
      setDeletingSong(false)
    }
  }

  const handleBulkDelete = async () => {
    const ids = [...selectedSongIds]
    if (!confirm(`Permanently delete ${ids.length} song${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setBulkDeleting(true); setBulkDeleteError(null)
    try {
      await axios.delete('/api/songs', { data: { ids } })
      const deleted = new Set(ids)
      if (selectedSong && deleted.has(selectedSong.id)) { setSelectedSong(null); setEditState(null) }
      setSongs(prev => prev.filter(s => !deleted.has(s.id)))
      onSongsReload()
      setSelectedSongIds(new Set()); setSelectMode(false)
    } catch (err: any) {
      setBulkDeleteError(err.response?.data?.error ?? 'Delete failed')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleBulkApplyLabel = async () => {
    const ids = [...selectedSongIds]
    const lbl = bulkLabelValue.trim()
    if (!lbl || ids.length === 0) return
    setBulkLabelApplying(true); setBulkLabelError(null); setBulkLabelSuccess(null)
    try {
      const { data } = await axios.post('/api/songs/bulk-label', { ids, label: lbl })
      setSongs(prev => prev.map(s =>
        ids.includes(s.id) && !s.source_labels.includes(lbl)
          ? { ...s, source_labels: [...s.source_labels, lbl] }
          : s
      ))
      onSongsReload()
      setBulkLabelSuccess(`Added "${lbl}" to ${data.updated} song${data.updated !== 1 ? 's' : ''}`)
      setBulkLabelValue('')
    } catch (err: any) {
      setBulkLabelError(err.response?.data?.error ?? 'Apply failed')
    } finally {
      setBulkLabelApplying(false)
    }
  }

  const toggleSongId = (id: string) => setSelectedSongIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const startRenameLabel = (label: string) => { setRenamingLabel(label); setRenameValue(label); setRenameError(null) }
  const handleRenameLabel = async () => {
    if (!renamingLabel) return
    const newLabel = renameValue.trim()
    if (!newLabel) { setRenameError('Label cannot be empty'); return }
    if (newLabel === renamingLabel) { setRenamingLabel(null); return }
    setRenameSaving(true); setRenameError(null)
    try {
      await Promise.all([
        axios.patch('/api/songs/labels/rename', { from: renamingLabel, to: newLabel }),
        axios.patch('/api/settings/source_labels/rename', { from: renamingLabel, to: newLabel }),
      ])
      setSongs(prev => prev.map(s => ({ ...s, source_labels: s.source_labels.map(l => l === renamingLabel ? newLabel : l) })))
      setSettings(prev => prev ? { ...prev, source_labels: prev.source_labels.map(l => l === renamingLabel ? newLabel : l).sort() } : prev)
      onLabelRename(renamingLabel, newLabel)
      onSongsReload()
      setRenamingLabel(null)
    } catch (err: any) {
      setRenameError(err.response?.data?.error ?? 'Rename failed')
    } finally {
      setRenameSaving(false)
    }
  }

  const addKnownLabel = async () => {
    const v = newSourceLabel.trim()
    if (!v) return
    setSettingsError(null)
    try {
      await axios.post('/api/settings/source_labels', { value: v })
      setSettings(prev => prev ? { ...prev, source_labels: [...prev.source_labels, v].sort() } : prev)
      setNewSourceLabel('')
    } catch (err: any) {
      setSettingsError(err.response?.data?.error ?? 'Failed to add')
    }
  }

  const deleteKnownLabel = async (value: string) => {
    setSettingsError(null)
    try {
      await axios.delete(`/api/settings/source_labels/${encodeURIComponent(value)}`)
      setSettings(prev => prev ? { ...prev, source_labels: prev.source_labels.filter(v => v !== value) } : prev)
    } catch (err: any) {
      setSettingsError(err.response?.data?.error ?? 'Failed to delete')
    }
  }

  const STARTER_THEMES = ['praise','worship','grace','salvation','hope','faith','love','surrender','holiness','presence','gratitude','redemption','glory','victory','peace','joy','trinity','resurrection']

  const addThemeToSettings = async () => {
    const v = newTheme.trim().toLowerCase()
    if (!v) return
    setSettingsError(null); setSettingsSuccess(null)
    try {
      await axios.post('/api/settings/themes', { value: v })
      setSettings(prev => prev ? { ...prev, themes: [...prev.themes, v].sort() } : prev)
      setNewTheme('')
    } catch (err: any) {
      setSettingsError(err.response?.data?.error ?? 'Failed to add')
    }
  }

  const deleteThemeFromSettings = async (value: string) => {
    setSettingsError(null)
    try {
      await axios.delete(`/api/settings/themes/${encodeURIComponent(value)}`)
      setSettings(prev => prev ? { ...prev, themes: prev.themes.filter(v => v !== value) } : prev)
    } catch (err: any) {
      setSettingsError(err.response?.data?.error ?? 'Failed to delete')
    }
  }

  const seedStarterThemes = async () => {
    setSettingsError(null); setSettingsSuccess(null)
    try {
      const { data } = await axios.post('/api/settings/themes/bulk', { values: STARTER_THEMES })
      setSettings(prev => prev ? {
        ...prev,
        themes: [...new Set([...prev.themes, ...STARTER_THEMES])].sort()
      } : prev)
      setSettingsSuccess(`Added ${data.added} starter themes`)
    } catch (err: any) {
      setSettingsError(err.response?.data?.error ?? 'Failed to seed themes')
    }
  }

  const togglePcoId = (id: string) => setSelectedPcoIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  // All known source labels: settings-defined + in-use from songs
  const allSourceLabels = [...new Set([...(settings?.source_labels ?? []), ...songs.flatMap(s => s.source_labels)])].sort()
  // All known themes: settings-defined + in-use from songs
  const allThemes = [...new Set([...(settings?.themes ?? []), ...songs.flatMap(s => s.song_metadata?.themes ?? [])])].sort()

  const filteredPreview = pcoPreview?.filter(i => {
    if (pcoFilter === 'archived') return i.hidden
    if (i.hidden) return false
    return pcoFilter === 'all' || i.status === pcoFilter
  }) ?? []

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

  const adminHelpText = (() => {
    if (view === 'pco') {
      if (!pcoConfigData?.appId) return 'Enter your PCO API credentials on the left, then load your Planning Center library to preview and import songs.'
      return 'PCO songs are matched against your library. New songs can be imported; matched songs update their last-used date. Select songs and click Import.'
    }
    if (view === 'add') {
      if (!addForm) return 'Search by title and artist to find a Spotify match — BPM, key, and release year are pre-filled automatically.'
      return `Review the pre-filled details for "${addForm.title}". Source labels, themes, and energy level affect how this song ranks in Library suggestions.`
    }
    if (view === 'settings') {
      if (settingsCategory === 'source_labels') return 'Source labels tag songs by publisher or series. They power the Library filter and can be renamed — the rename applies to all songs automatically.'
      if (settingsCategory === 'themes') return "Themes describe a song's lyrical focus. They appear on song cards and group compatible songs together in Library suggestions."
      if (settingsCategory === 'time_signatures') return 'Custom time signatures appear alongside the standard ones (4/4, 3/4, etc.) when editing an arrangement.'
      return 'Styles describe the musical genre or feel of a song — used in the suggestion engine and shown in the song editor.'
    }
    if (selectedSong) return `Editing key, tempo, energy, and themes refines how "${selectedSong.title}" pairs with others in Library. Changes take effect after saving.`
    return 'Select a song to edit its arrangement data, themes, and metadata. These attributes drive how songs are ranked in Library suggestions.'
  })()

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
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-gray-400">{filtered.length} songs</p>
                  <button
                    onClick={() => { setShowUnlabeled(v => !v); setSelectedSongIds(new Set()) }}
                    className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${showUnlabeled ? 'bg-amber-50 text-amber-700 border-amber-300' : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}
                  >
                    Unlabeled
                  </button>
                  <button
                    onClick={() => { setShowRetired(v => !v); setSelectedSongIds(new Set()) }}
                    className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${showRetired ? 'bg-red-50 text-red-600 border-red-300' : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}
                  >
                    Retired
                  </button>
                </div>
                <button
                  onClick={() => { setSelectMode(m => !m); setSelectedSongIds(new Set()); setBulkDeleteError(null); setBulkLabelError(null); setBulkLabelSuccess(null); setBulkLabelValue('') }}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${selectMode ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
                >
                  {selectMode ? 'Cancel' : 'Select'}
                </button>
              </div>
              {selectMode && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelectedSongIds(new Set(filtered.map(s => s.id)))}
                    className="text-xs px-1.5 py-0.5 border border-gray-300 text-gray-600 rounded hover:border-gray-500"
                  >All</button>
                  {[...new Set(filtered.flatMap(s => s.source_labels))].sort().map(l => (
                    <button
                      key={l}
                      onClick={() => setSelectedSongIds(prev => {
                        const next = new Set(prev)
                        filtered.filter(s => s.source_labels.includes(l)).forEach(s => next.add(s.id))
                        return next
                      })}
                      className="text-xs px-1.5 py-0.5 border border-blue-200 text-blue-600 rounded hover:border-blue-400"
                    >{l}</button>
                  ))}
                  {filtered.some(s => s.pco_song_id) && (
                    <button
                      onClick={() => setSelectedSongIds(prev => {
                        const next = new Set(prev)
                        filtered.filter(s => s.pco_song_id).forEach(s => next.add(s.id))
                        return next
                      })}
                      className="text-xs px-1.5 py-0.5 border border-purple-200 text-purple-600 rounded hover:border-purple-400"
                    >PCO</button>
                  )}
                  {filtered.some(s => s.source_labels.length === 0) && (
                    <button
                      onClick={() => setSelectedSongIds(prev => {
                        const next = new Set(prev)
                        filtered.filter(s => s.source_labels.length === 0).forEach(s => next.add(s.id))
                        return next
                      })}
                      className="text-xs px-1.5 py-0.5 border border-amber-200 text-amber-600 rounded hover:border-amber-400"
                    >Unlabeled</button>
                  )}
                </div>
              )}
            </div>
            {selectMode && (
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500 flex-1">{selectedSongIds.size} selected</p>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting || selectedSongIds.size === 0}
                    className="text-xs px-2.5 py-1 border border-red-200 text-red-500 hover:bg-red-50 rounded disabled:opacity-40"
                  >
                    {bulkDeleting ? 'Deleting…' : `Delete ${selectedSongIds.size > 0 ? selectedSongIds.size : ''}`}
                  </button>
                </div>
                {bulkDeleteError && <p className="text-xs text-red-500">{bulkDeleteError}</p>}
                {/* Apply label */}
                <div className="flex gap-1">
                  <input
                    type="text"
                    list="bulk-label-suggestions"
                    placeholder="Apply label..."
                    value={bulkLabelValue}
                    onChange={e => { setBulkLabelValue(e.target.value); setBulkLabelError(null); setBulkLabelSuccess(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleBulkApplyLabel()}
                    className={`flex-1 min-w-0 px-2 py-1 text-xs ${fieldClass}`}
                  />
                  <datalist id="bulk-label-suggestions">
                    {allSourceLabels.map(l => <option key={l} value={l} />)}
                  </datalist>
                  <button
                    onClick={handleBulkApplyLabel}
                    disabled={bulkLabelApplying || selectedSongIds.size === 0 || !bulkLabelValue.trim()}
                    className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 flex-shrink-0"
                  >
                    {bulkLabelApplying ? '…' : 'Apply'}
                  </button>
                </div>
                {bulkLabelError && <p className="text-xs text-red-500">{bulkLabelError}</p>}
                {bulkLabelSuccess && <p className="text-xs text-green-600">{bulkLabelSuccess}</p>}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {filtered.map(song => {
                const primary = song.arrangements.find(a => a.is_primary) ?? song.arrangements[0]
                const isSelected = selectedSong?.id === song.id
                const isChecked = selectedSongIds.has(song.id)
                return (
                  <button
                    key={song.id}
                    onClick={() => selectMode ? toggleSongId(song.id) : openEdit(song)}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-center gap-2 ${!selectMode && isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''} ${selectMode && isChecked ? 'bg-red-50' : ''}`}
                  >
                    {selectMode && (
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSongId(song.id)} onClick={e => e.stopPropagation()} className="w-4 h-4 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${!selectMode && isSelected ? 'text-blue-800' : 'text-gray-800'}`}>{song.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                        <span className="truncate">{song.artist}</span>
                        {primary && <span className="text-gray-400 flex-shrink-0">{primary.key_signature} · {primary.tempo_bpm} BPM</span>}
                      </div>
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
              {pcoConfigData?.appId && (
                <p className="text-xs text-green-600 mb-3">{pcoConfigData.configured ? 'Connected' : 'Credentials from .env'} · {pcoConfigData.pcoSongCount} songs imported</p>
              )}
            </div>
            {pcoConnError && <p className="text-xs text-red-500">{pcoConnError}</p>}
            {pcoSaveSuccess && <p className="text-xs text-green-600">Connection saved</p>}
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
              {pcoConfigData?.appId && (
                <button onClick={resetPcoConnection} disabled={pcoSaving} className="text-xs px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 rounded disabled:opacity-50">
                  Reset
                </button>
              )}
            </div>
            {pcoConfigData?.appId && (
              <button onClick={loadPcoPreview} disabled={pcoLoading} className="text-xs py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {pcoLoading ? 'Loading…' : 'Load PCO Library'}
              </button>
            )}

            {pcoServiceTypes !== null && pcoConfigData?.appId && (
              <div className="flex flex-col gap-1 pt-1 border-t border-gray-200">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service Type</span>
                <p className="text-xs text-gray-400 leading-snug">Filter "last used" dates to a specific service type (e.g. Sunday Main, Youth).</p>
                <select
                  className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
                  value={pcoConfigData.serviceTypeId ?? ''}
                  disabled={pcoServiceTypeSaving}
                  onChange={async e => {
                    const val = e.target.value
                    setPcoConfigData(prev => prev ? { ...prev, serviceTypeId: val || null } : prev)
                    setPcoServiceTypeSaving(true)
                    try {
                      await axios.put('/api/pco/config', { service_type_id: val })
                    } catch (err: any) {
                      console.error('Failed to save service type:', err.response?.data?.error ?? err.message)
                    } finally {
                      setPcoServiceTypeSaving(false)
                    }
                  }}
                >
                  <option value="">All service types</option>
                  {pcoServiceTypes.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
                {pcoServiceTypeSaving && <p className="text-xs text-gray-400">Saving…</p>}
                {pcoConfigData.serviceTypeId && (
                  <button
                    onClick={async () => {
                      setPcoScheduleSyncing(true); setPcoScheduleSyncResult(null)
                      try {
                        const { data } = await axios.post('/api/pco/sync-schedule', {
                          service_type_id: pcoConfigData.serviceTypeId,
                        })
                        const [freshSongs] = await Promise.all([
                          axios.get('/api/songs', { params: { include_retired: 'true' } }).then(r => r.data),
                          onSongsReload(),
                        ])
                        setSongs(freshSongs)
                        setSelectedSong(prev => prev ? (freshSongs.find((s: Song) => s.id === prev.id) ?? prev) : null)
                        setPcoScheduleSyncResult(data.message ?? `Updated ${data.updated} songs`)
                        setTimeout(() => setPcoScheduleSyncResult(null), 4000)
                      } catch (err: any) {
                        setPcoScheduleSyncResult(err.response?.data?.error ?? 'Sync failed')
                      } finally {
                        setPcoScheduleSyncing(false)
                      }
                    }}
                    disabled={pcoScheduleSyncing}
                    className="text-xs py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                  >
                    {pcoScheduleSyncing ? 'Syncing…' : 'Sync last used dates'}
                  </button>
                )}
                {pcoScheduleSyncResult && (
                  <p className={`text-xs ${pcoScheduleSyncResult.includes('Updated') ? 'text-green-600' : 'text-gray-400'}`}>
                    {pcoScheduleSyncResult}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {view === 'settings' && (
          <div className="flex-1 overflow-y-auto">
            {/* Category nav */}
            {[
              { key: 'source_labels' as const, label: 'Source Labels', count: allSourceLabels.length },
              { key: 'themes' as const,        label: 'Themes',        count: allThemes.length },
              { key: 'time_signatures' as const, label: 'Time Signatures', count: (settings?.time_signatures.base.length ?? 0) + (settings?.time_signatures.custom.length ?? 0) },
              { key: 'styles' as const,        label: 'Styles',        count: (settings?.styles.base.length ?? 0) + (settings?.styles.custom.length ?? 0) },
            ].map(cat => (
              <button
                key={cat.key}
                onClick={() => { setSettingsCategory(cat.key); setSettingsError(null); setSettingsSuccess(null) }}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 flex items-center justify-between transition-colors ${
                  settingsCategory === cat.key ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`text-sm ${settingsCategory === cat.key ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{cat.label}</span>
                <span className="text-xs text-gray-400">{cat.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: edit panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <HelpBanner id="admin" text={adminHelpText} />
        <div className="flex-1 overflow-y-auto">
        {view === 'pco' ? (
          !pcoPreview ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              {pcoLoading ? 'Loading PCO library…' : pcoConfigData?.appId ? 'Click "Load PCO Library" to preview songs' : 'Configure your PCO connection on the left'}
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Summary + controls */}
              <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
                <div className="flex gap-2 text-xs flex-wrap">
                  {(['all', 'new', 'match', 'imported', 'archived'] as const).map(f => {
                    const count = f === 'all'
                      ? pcoPreview.filter(i => !i.hidden).length
                      : f === 'archived'
                      ? pcoPreview.filter(i => i.hidden).length
                      : pcoPreview.filter(i => !i.hidden && i.status === f).length
                    const label = f === 'all' ? 'All' : f === 'new' ? 'New' : f === 'match' ? 'Matched' : f === 'imported' ? 'Imported' : 'Archived'
                    const isArchived = f === 'archived'
                    return (
                      <button key={f} onClick={() => setPcoFilter(f)}
                        className={`px-2.5 py-1 rounded border transition-colors ${
                          pcoFilter === f
                            ? isArchived ? 'bg-amber-600 text-white border-amber-600' : 'bg-gray-700 text-white border-gray-700'
                            : isArchived ? 'border-amber-200 text-amber-600 hover:border-amber-400' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}>
                        {label} ({count})
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <button
                    onClick={() => {
                      const visibleIds = filteredPreview.map(i => i.pcoId)
                      const allSelected = visibleIds.every(id => selectedPcoIds.has(id))
                      setSelectedPcoIds(prev => {
                        const next = new Set(prev)
                        if (allSelected) visibleIds.forEach(id => next.delete(id))
                        else visibleIds.forEach(id => next.add(id))
                        return next
                      })
                    }}
                    className="text-xs px-2.5 py-1.5 border border-gray-200 text-gray-500 hover:border-gray-400 rounded"
                  >
                    {filteredPreview.every(i => selectedPcoIds.has(i.pcoId)) ? 'Deselect all' : 'Select all'}
                  </button>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={overwriteMetadata} onChange={e => setOverwriteMetadata(e.target.checked)} className="w-3.5 h-3.5" />
                    Overwrite BPM/key/time sig
                  </label>
                  <button onClick={runPcoImport} disabled={pcoImporting || selectedPcoIds.size === 0}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 min-w-[140px]">
                    {pcoImporting && pcoProgress
                      ? `Importing ${pcoProgress.done} / ${pcoProgress.total}…`
                      : `Import ${selectedPcoIds.size} selected`}
                  </button>
                </div>
              </div>
              {pcoImporting && pcoProgress && (
                <div className="px-4 py-1.5 border-b border-gray-200 bg-gray-50">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((pcoProgress.done / pcoProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
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
                      className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{item.title}</div>
                      <div className="text-xs text-gray-500 truncate">{item.author}{item.ccliNumber ? ` · CCLI ${item.ccliNumber}` : ''}</div>
                      {item.status === 'match' && (
                        <div className="text-xs text-amber-600">Matches: {item.existingTitle} <span className="text-gray-400">via {item.matchedBy}</span></div>
                      )}
                    </div>
                    {item.hidden && (
                      <span className="text-xs px-2 py-0.5 rounded flex-shrink-0 bg-amber-50 text-amber-700 border border-amber-200">archived</span>
                    )}
                    {!item.hidden && (
                      <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                        item.status === 'new' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        item.status === 'match' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}>
                        {item.status}
                      </span>
                    )}
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

              {addDuplicates.length > 0 && (
                <div className="mb-6 border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-2">
                    {addDuplicates.length === 1
                      ? 'A song with this title already exists in your library:'
                      : `${addDuplicates.length} songs with this title already exist in your library:`}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {addDuplicates.map(s => (
                      <div key={s.id} className="text-xs bg-white border border-amber-200 rounded px-2.5 py-1.5">
                        <span className="font-medium text-gray-800">{s.title}</span>
                        <span className="text-gray-500"> · {s.artist}</span>
                        {s.released_year && <span className="text-gray-400"> · {s.released_year}</span>}
                        {s.source_labels.length > 0 && (
                          <span className="ml-1.5">
                            {s.source_labels.map(l => (
                              <span key={l} className="inline-block bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-px rounded mr-1">{l}</span>
                            ))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-2">You can still add this song if it's a different version or recording.</p>
                </div>
              )}

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
                  {allSourceLabels
                    .filter(l => !addForm.source_labels.includes(l))
                    .map(l => (
                      <button key={l} onClick={() => setAddForm(prev => prev ? { ...prev, source_labels: [...prev.source_labels, l] } : prev)} className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 px-1.5 py-0.5 rounded transition-colors">+ {l}</button>
                    ))}
                </div>
              </section>

              {/* Arrangement */}
              <section className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Arrangement</h3>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-3">
                  Spotify no longer provides audio features. Enter the correct Key, Tempo, and Time Signature below.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Key</span>
                    <select value={addForm.key_signature} onChange={e => setAddForm(prev => prev ? { ...prev, key_signature: e.target.value } : prev)} className={`px-2 py-1.5 text-sm ${fieldClass}`}>
                      {KEY_SIGNATURES.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Tempo (BPM)</span>
                    <BpmField bpm={addForm.tempo_bpm} timeSignature={addForm.time_signature} onChange={(b, e) => setAddForm(prev => prev ? { ...prev, tempo_bpm: b, energy_level: e } : prev)} />
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Time Signature</span>
                    <select value={addForm.time_signature} onChange={e => setAddForm(prev => prev ? { ...prev, time_signature: e.target.value, energy_level: bpmToEnergy(prev.tempo_bpm, e.target.value) } : prev)} className={`px-2 py-1.5 text-sm ${fieldClass}`}>
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
                  {allThemes.filter(t => !addForm.themes.includes(t)).map(t => (
                    <button key={t} onClick={() => setAddForm(prev => prev ? { ...prev, themes: [...prev.themes, t] } : prev)} className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 px-1.5 py-0.5 rounded transition-colors">+ {t}</button>
                  ))}
                </div>
              </section>

              <div className="flex items-center gap-3">
                <button onClick={handleAddSong} disabled={addSaving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                  {addSaving ? 'Adding…' : 'Add to library'}
                </button>
                <button onClick={() => { setAddForm(null); setAddPicked(null); setAddDuplicates([]) }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                {addError && <span className="text-sm text-red-500">{addError}</span>}
              </div>
            </div>
          )
        ) : view === 'settings' ? (
          <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
            {settingsError && <p className="text-xs text-red-500 mb-3">{settingsError}</p>}
            {settingsSuccess && <p className="text-xs text-green-600 mb-3">{settingsSuccess}</p>}
            {renameError && settingsCategory === 'source_labels' && <p className="text-xs text-red-500 mb-3">{renameError}</p>}

            {/* Source Labels */}
            {settingsCategory === 'source_labels' && (
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-1">Source Labels</h2>
                <p className="text-xs text-gray-500 mb-4">Labels assigned to songs by publisher or series. Unused labels persist for future use.</p>
                <div className="flex flex-col gap-1 mb-4">
                  {allSourceLabels.map(label => {
                    const useCount = songs.filter(s => s.source_labels.includes(label)).length
                    const inSettings = settings?.source_labels.includes(label) ?? false
                    return (
                      <div key={label} className="flex items-center gap-3 px-3 py-2 bg-white border border-gray-200 rounded text-sm">
                        {renamingLabel === label ? (
                          <>
                            <input autoFocus type="text" value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRenameLabel(); if (e.key === 'Escape') setRenamingLabel(null) }}
                              className="flex-1 min-w-0 bg-transparent outline-none border-b border-gray-400 text-gray-800" />
                            <button onClick={handleRenameLabel} disabled={renameSaving} className="text-blue-600 hover:text-blue-800 disabled:opacity-50 text-xs">{renameSaving ? '…' : 'Save'}</button>
                            <button onClick={() => setRenamingLabel(null)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-gray-800">{label}</span>
                            {useCount > 0 ? <span className="text-xs text-gray-400">{useCount} song{useCount !== 1 ? 's' : ''}</span> : <span className="text-xs text-gray-300 italic">unused</span>}
                            <button onClick={() => startRenameLabel(label)} className="text-xs text-gray-400 hover:text-blue-600">Rename</button>
                            {useCount === 0 && inSettings && (
                              <button onClick={() => deleteKnownLabel(label)} className="text-xs text-gray-400 hover:text-red-500">✕</button>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                  {allSourceLabels.length === 0 && <p className="text-sm text-gray-400">No source labels yet</p>}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="e.g. Elevation" value={newSourceLabel}
                    onChange={e => setNewSourceLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addKnownLabel()}
                    className={`flex-1 px-3 py-1.5 text-sm ${fieldClass}`} />
                  <button onClick={addKnownLabel} className="text-sm px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800">Add</button>
                </div>
              </div>
            )}

            {/* Themes */}
            {settingsCategory === 'themes' && (
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-1">Themes</h2>
                <p className="text-xs text-gray-500 mb-4">Worship themes used to tag songs and improve pairing suggestions.</p>
                {allThemes.length === 0 && (
                  <div className="mb-4 p-3 border border-dashed border-gray-300 rounded-lg text-center">
                    <p className="text-sm text-gray-500 mb-2">No themes yet</p>
                    <button onClick={seedStarterThemes} className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                      Add starter themes
                    </button>
                  </div>
                )}
                {allThemes.length > 0 && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {allThemes.map(theme => {
                        const useCount = songs.filter(s => s.song_metadata?.themes.includes(theme)).length
                        const inSettings = settings?.themes.includes(theme) ?? false
                        return (
                          <div key={theme} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs">
                            <span className="text-gray-700">{theme}</span>
                            {useCount > 0
                              ? <span className="text-gray-400">{useCount}</span>
                              : <span className="text-gray-300 italic">unused</span>
                            }
                            {useCount === 0 && inSettings && (
                              <button onClick={() => deleteThemeFromSettings(theme)} className="text-gray-300 hover:text-red-500 leading-none">✕</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <button onClick={seedStarterThemes} className="text-xs text-gray-400 hover:text-gray-600 mb-4 block">
                      + Add any missing starter themes
                    </button>
                  </>
                )}
                <div className="flex gap-2">
                  <input type="text" placeholder="e.g. communion" value={newTheme}
                    onChange={e => setNewTheme(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addThemeToSettings()}
                    className={`flex-1 px-3 py-1.5 text-sm ${fieldClass}`} />
                  <button onClick={addThemeToSettings} className="text-sm px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800">Add</button>
                </div>
              </div>
            )}

            {/* Time Signatures */}
            {settingsCategory === 'time_signatures' && (
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-1">Time Signatures</h2>
                <p className="text-xs text-gray-500 mb-4">Available time signature options when editing arrangements.</p>
                <div className="flex flex-col gap-1 mb-4">
                  {settings?.time_signatures.base.map(v => (
                    <div key={v} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-500">
                      <span>{v}</span><span className="text-xs text-gray-300">base</span>
                    </div>
                  ))}
                  {settings?.time_signatures.custom.map(v => (
                    <div key={v} className="flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700">
                      <span>{v}</span>
                      <button onClick={() => deleteTimeSig(v)} className="text-gray-400 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="e.g. 5/4" value={newTimeSig}
                    onChange={e => setNewTimeSig(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTimeSig()}
                    className={`flex-1 px-3 py-1.5 text-sm ${fieldClass}`} />
                  <button onClick={addTimeSig} className="text-sm px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800">Add</button>
                </div>
              </div>
            )}

            {/* Styles */}
            {settingsCategory === 'styles' && (
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-1">Styles</h2>
                <p className="text-xs text-gray-500 mb-4">Song style categories used for filtering and metadata.</p>
                <div className="flex flex-col gap-1 mb-4">
                  {settings?.styles.base.map(v => (
                    <div key={v} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-500">
                      <span>{v}</span><span className="text-xs text-gray-300">base</span>
                    </div>
                  ))}
                  {settings?.styles.custom.map(v => (
                    <div key={v} className="flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700">
                      <span>{v}</span>
                      <button onClick={() => deleteStyle(v)} className="text-gray-400 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="e.g. contemporary" value={newStyle}
                    onChange={e => setNewStyle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addStyle()}
                    className={`flex-1 px-3 py-1.5 text-sm ${fieldClass}`} />
                  <button onClick={addStyle} className="text-sm px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800">Add</button>
                </div>
              </div>
            )}
          </div>
        ) : !selectedSong ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Select a song to edit
          </div>
        ) : editState ? (
          <div className="max-w-2xl mx-auto p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex-1 flex flex-col gap-1.5">
                {(['title', 'artist'] as const).map(field => (
                  <div key={field} className="flex items-center gap-1.5 group">
                    {editingField === field ? (
                      <>
                        <input
                          autoFocus
                          type="text"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveField(); if (e.key === 'Escape') setEditingField(null) }}
                          className={`flex-1 px-2 py-1 ${field === 'title' ? 'text-lg font-semibold' : 'text-sm text-gray-600'} ${fieldClass}`}
                        />
                        <button
                          onClick={saveField}
                          disabled={savingField}
                          className="text-green-500 hover:text-green-700 text-base leading-none disabled:opacity-50"
                          title="Save"
                        >✓</button>
                        <button
                          onClick={() => setEditingField(null)}
                          className="text-gray-400 hover:text-gray-600 text-xs leading-none"
                          title="Cancel"
                        >✕</button>
                      </>
                    ) : (
                      <>
                        <span className={`flex-1 ${field === 'title' ? 'text-lg font-semibold text-gray-800' : 'text-sm text-gray-500'}`}>
                          {editState[field]}
                        </span>
                        <button
                          onClick={() => { setEditingField(field); setEditingValue(editState[field]) }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity text-xs"
                          title={`Edit ${field}`}
                        >✎</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {(selectedSong.released_year ?? selectedSong.released_at) && (
                <span
                  title="Release Date"
                  className="text-sm text-gray-400 flex-shrink-0 cursor-default"
                >
                  {selectedSong.released_year ?? selectedSong.released_at!.split('-')[0]}
                </span>
              )}
            </div>

            {/* Spotify preview */}
            <section className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Spotify</h3>
              <SpotifyPreview
                key={selectedSong.id}
                song={selectedSong}
                onTrackLinked={updated => {
                  setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))
                  setSelectedSong(updated)
                  onSongUpdate(updated)
                }}
              />
            </section>

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
                {allSourceLabels
                  .filter(l => !editState.source_labels.includes(l))
                  .map(l => (
                    <button key={l} onClick={() => addSourceLabel(l)} className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 px-1.5 py-0.5 rounded transition-colors">+ {l}</button>
                  ))}
              </div>
            </section>

            {/* PCO connection status */}
            {selectedSong.pco_song_id && (
              <div className="mb-6 flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                <span className="font-medium">Planning Center</span>
                <span className="text-purple-300">·</span>
                <span>Connected</span>
                {selectedSong.last_scheduled_at && (
                  <>
                    <span className="text-purple-300">·</span>
                    <span>Last scheduled {new Date(selectedSong.last_scheduled_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </>
                )}
              </div>
            )}

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
                  <BpmField bpm={editState.tempo_bpm} timeSignature={editState.time_signature} onChange={(b, e) => setEditState(prev => prev ? { ...prev, tempo_bpm: b, energy_level: e } : prev)} />
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Time Signature</span>
                  <select value={editState.time_signature} onChange={e => setEditState(prev => prev ? { ...prev, time_signature: e.target.value, energy_level: bpmToEnergy(prev.tempo_bpm, e.target.value) } : prev)} className={`px-2 py-1.5 text-sm ${fieldClass}`}>
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
                {allThemes.filter(t => !editState.themes.includes(t)).map(t => (
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
                {selectedSong.arrangements.filter(a => !a.is_primary).sort((a, b) => (a.name ?? a.key_signature).localeCompare(b.name ?? b.key_signature)).map(arr => (
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
                            <BpmField bpm={editingArr.tempo_bpm} timeSignature={editingArr.time_signature} size="sm" onChange={(b, e) => setEditingArr(prev => prev ? { ...prev, tempo_bpm: b, energy_level: e } : prev)} />
                          </div>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">Time</span>
                            <select value={editingArr.time_signature} onChange={e => setEditingArr(prev => prev ? { ...prev, time_signature: e.target.value, energy_level: bpmToEnergy(prev.tempo_bpm, e.target.value) } : prev)} className={`px-1.5 py-1 text-sm ${fieldClass}`}>
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
                      {allSourceLabels
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
                    <BpmField bpm={newArr.tempo_bpm} timeSignature={newArr.time_signature} size="sm" onChange={(b, e) => setNewArr(prev => ({ ...prev, tempo_bpm: b, energy_level: e }))} />
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Time</span>
                    <select value={newArr.time_signature} onChange={e => setNewArr(prev => ({ ...prev, time_signature: e.target.value, energy_level: bpmToEnergy(prev.tempo_bpm, e.target.value) }))} className={`px-1.5 py-1 text-sm ${fieldClass}`}>
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

            {/* Danger zone */}
            <div className="mt-8 pt-6 border-t border-gray-200 mb-8">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3">Danger Zone</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleRetireSong}
                  className={`text-xs px-3 py-1.5 border rounded ${
                    selectedSong?.is_retired
                      ? 'border-amber-300 text-amber-600 hover:bg-amber-50'
                      : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {selectedSong?.is_retired ? 'Unretire this song' : 'Retire this song'}
                </button>
                <button
                  onClick={handleDeleteSong}
                  disabled={deletingSong}
                  className="text-xs px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                >
                  {deletingSong ? 'Deleting…' : 'Delete this song'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  )
}
