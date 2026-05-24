import { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import type { Song, Arrangement, SuggestionResult, SetItem, ClientFilters } from './types'
import SongList from './components/SongList'
import SetBuilder from './components/SetBuilder'
import SourceFilter from './components/SourceFilter'
import AdminPanel from './components/AdminPanel'
import FeedbackModal from './components/FeedbackModal'

type Tab = 'library' | 'admin'

function songMatchesFilters(song: Song, f: ClientFilters): boolean {
  if (f.keys.length > 0 && !song.arrangements.some(a => f.keys.includes(a.key_signature))) return false
  if (f.bpmMin !== '' && !song.arrangements.some(a => a.tempo_bpm >= (f.bpmMin as number))) return false
  if (f.bpmMax !== '' && !song.arrangements.some(a => a.tempo_bpm <= (f.bpmMax as number))) return false
  if (f.energy.length > 0 && !song.arrangements.some(a => f.energy.includes(a.energy_level))) return false
  if (f.theologicalDepth.length > 0) {
    const d = song.song_metadata?.theological_depth
    if (!d || !f.theologicalDepth.includes(d)) return false
  }
  if (f.themes.length > 0) {
    const t = song.song_metadata?.themes ?? []
    if (!f.themes.some(th => t.includes(th))) return false
  }
  if (f.pcoNotUsedMonths !== '' && song.last_scheduled_at !== null) {
    const months = (Date.now() - new Date(song.last_scheduled_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    if (months <= (f.pcoNotUsedMonths as number)) return false
  }
  return true
}

export default function App() {
  const [tab, setTab] = useState<Tab>('library')
  const [songs, setSongs] = useState<Song[]>([])
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [selectedArrangement, setSelectedArrangement] = useState<Arrangement | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([])
  const [setList, setSetList] = useState<SetItem[]>([])
  const [activeSources, setActiveSources] = useState<string[]>([])
  const [sourcesInitialised, setSourcesInitialised] = useState(false)
  const [withinYears, setWithinYears] = useState<string>('')
  const [pcoOnly, setPcoOnly] = useState(false)
  const [includeUnlabeled, setIncludeUnlabeled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showRetired, setShowRetired] = useState(false)
  const [adminOpenSongId, setAdminOpenSongId] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [clientFilters, setClientFilters] = useState<ClientFilters>({
    keys: [], bpmMin: '', bpmMax: '', energy: [], theologicalDepth: [], themes: [], pcoNotUsedMonths: '',
  })

  const LEFT_MIN = 208
  const RIGHT_MIN = 288
  const [leftWidth, setLeftWidth] = useState(LEFT_MIN)
  const [rightWidth, setRightWidth] = useState(RIGHT_MIN)
  const leftDrag = useRef<{ startX: number; startWidth: number } | null>(null)
  const rightDrag = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (leftDrag.current) {
        setLeftWidth(Math.max(LEFT_MIN, leftDrag.current.startWidth + (e.clientX - leftDrag.current.startX)))
      }
      if (rightDrag.current) {
        setRightWidth(Math.max(RIGHT_MIN, rightDrag.current.startWidth - (e.clientX - rightDrag.current.startX)))
      }
    }
    const onUp = () => {
      leftDrag.current = null
      rightDrag.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Available labels grow as songs load but never shrink (so filter chips don't vanish when filtering)
  const [availableLabels, setAvailableLabels] = useState<string[]>([])
  useEffect(() => {
    setAvailableLabels(prev => {
      const merged = [...new Set([...prev, ...songs.flatMap(s => s.source_labels)])].sort()
      return merged.length !== prev.length ? merged : prev
    })
  }, [songs])

  const availableKeys = useMemo(() => {
    const found = new Set<string>()
    songs.forEach(s => s.arrangements.forEach(a => found.add(a.key_signature)))
    const ORDER = ['A','Am','Bb','Bbm','B','Bm','C','Cm','C#','C#m','Db','D','Dm','Eb','Ebm','E','Em','F','Fm','F#','F#m','Gb','G','Gm','Ab','Abm']
    return ORDER.filter(k => found.has(k))
  }, [songs])

  const availableThemes = useMemo(() => {
    const found = new Set<string>()
    songs.forEach(s => (s.song_metadata?.themes ?? []).forEach(t => found.add(t)))
    return [...found].sort()
  }, [songs])

  const filteredSongs = useMemo(() =>
    songs.filter(s => s.id === selectedSong?.id || songMatchesFilters(s, clientFilters))
  , [songs, clientFilters, selectedSong])

  const setListIds = useMemo(() => new Set(setList.map(item => item.song.id)), [setList])

  const filteredSuggestions = useMemo(() =>
    suggestions.filter(s => {
      const song = songs.find(x => x.id === s.song.id)
      return !song || songMatchesFilters(song, clientFilters)
    })
  , [suggestions, songs, clientFilters])

  // Initialise activeSources once songs first load; add any new labels automatically
  useEffect(() => {
    if (availableLabels.length === 0) return
    if (!sourcesInitialised) {
      setActiveSources(availableLabels)
      setSourcesInitialised(true)
    } else {
      setActiveSources(prev => {
        const newLabels = availableLabels.filter(l => !prev.includes(l))
        return newLabels.length ? [...prev, ...newLabels] : prev
      })
    }
  }, [availableLabels])

  const buildParams = (): Record<string, string> => {
    const params: Record<string, string> = {}
    if (sourcesInitialised && activeSources.length < availableLabels.length) {
      params.source_labels = activeSources.join(',')
    }
    if (withinYears) params.within_years = withinYears
    if (pcoOnly) params.pco_only = 'true'
    if (!includeUnlabeled) params.exclude_unlabeled = 'true'
    if (showRetired) params.include_retired = 'true'
    return params
  }

  // Fetch songs when filters change
  useEffect(() => {
    axios.get('/api/songs', { params: buildParams() })
      .then(res => setSongs(res.data))
      .catch(console.error)
  }, [activeSources, withinYears, pcoOnly, includeUnlabeled, sourcesInitialised, showRetired])

  // Fetch suggestions when anchor song or arrangement changes
  useEffect(() => {
    if (!selectedSong || !selectedArrangement) return
    const fetchSuggestions = async () => {
      setLoading(true)
      try {
        const params: Record<string, string> = {
          ...buildParams(),
          key_number:     String(selectedArrangement.key_number),
          key_signature:  selectedArrangement.key_signature,
          tempo_bpm:      String(selectedArrangement.tempo_bpm),
          time_signature: selectedArrangement.time_signature,
          energy_level:   String(selectedArrangement.energy_level),
        }
        const res = await axios.get(`/api/songs/${selectedSong.id}/suggestions`, { params })
        setSuggestions(res.data.suggestions)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchSuggestions()
  }, [selectedSong, selectedArrangement, activeSources, withinYears, pcoOnly, includeUnlabeled])

  const addToSet = (song: Song, arrangement: Arrangement) => {
    if (!setList.find(item => item.song.id === song.id)) {
      setSetList(prev => [...prev, { song, arrangement }])
    }
  }

  const removeFromSet = (songId: string) => {
    setSetList(prev => prev.filter(item => item.song.id !== songId))
  }

  const addPairToSet = (suggestionSong: Song, suggestionArrangement: Arrangement) => {
    if (!selectedSong || !selectedArrangement) return
    setSetList(prev => {
      const withoutBoth = prev.filter(item => item.song.id !== selectedSong.id && item.song.id !== suggestionSong.id)
      return [...withoutBoth, { song: selectedSong, arrangement: selectedArrangement }, { song: suggestionSong, arrangement: suggestionArrangement }]
    })
    setSelectedSong(null)
    setSelectedArrangement(null)
    setSuggestions([])
  }

  const handleSongUpdate = (updated: Song) => {
    setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  const handleSongAdd = (song: Song) => {
    setSongs(prev => [...prev, song].sort((a, b) => a.title.localeCompare(b.title)))
    setActiveSources(prev => {
      const newLabels = song.source_labels.filter(l => !prev.includes(l))
      return newLabels.length ? [...prev, ...newLabels] : prev
    })
  }

  const handleLabelRename = (from: string, to: string) => {
    setAvailableLabels(prev => [...new Set(prev.map(l => l === from ? to : l))].sort())
    setActiveSources(prev => prev.map(l => l === from ? to : l))
  }

  const handleSongsReload = async () => {
    const res = await axios.get('/api/songs', { params: buildParams() })
    setSongs(res.data)
  }

  return (
    <div className="flex h-screen bg-gray-100 text-sm overflow-hidden">
      {/* Left: Sidebar */}
      <div className="bg-white border-r border-gray-200 flex flex-col flex-shrink-0" style={{ width: leftWidth }}>
        <div className="p-4 border-b border-gray-200">
          <h1 className="font-semibold text-gray-800 text-base">WorshipSet</h1>
          <p className="text-xs text-gray-500 mt-0.5">Set list builder</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('library')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab === 'library'
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setTab('admin')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab === 'admin'
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Admin
          </button>
        </div>

        {tab === 'library' && (
          <SourceFilter
            availableLabels={availableLabels}
            activeSources={activeSources}
            onToggle={label => setActiveSources(prev =>
              prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]
            )}
            withinYears={withinYears}
            onWithinYearsChange={setWithinYears}
            pcoOnly={pcoOnly}
            onPcoOnlyChange={setPcoOnly}
            includeUnlabeled={includeUnlabeled}
            onIncludeUnlabeledChange={setIncludeUnlabeled}
            clientFilters={clientFilters}
            onClientFiltersChange={setClientFilters}
            availableKeys={availableKeys}
            availableThemes={availableThemes}
            width={leftWidth}
          />
        )}
      </div>

      {/* Left resize handle */}
      <div
        className="w-1 flex-shrink-0 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize"
        onMouseDown={e => {
          leftDrag.current = { startX: e.clientX, startWidth: leftWidth }
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
          e.preventDefault()
        }}
      />

      {/* Main content */}
      {tab === 'library' ? (
        <>
          <div className="flex-1 flex flex-col overflow-hidden">
            <SongList
              songs={filteredSongs}
              selectedSong={selectedSong}
              selectedArrangement={selectedArrangement}
              setListIds={setListIds}
              onSelectAnchor={(song, arrangement) => { setSelectedSong(song); setSelectedArrangement(arrangement); setSearch('') }}
              onClearAnchor={() => { setSelectedSong(null); setSelectedArrangement(null); setSuggestions([]) }}
              suggestions={filteredSuggestions}
              loading={loading}
              onAddToSet={addToSet}
              onAddPairToSet={addPairToSet}
              search={search}
              onSearchChange={setSearch}
              showRetired={showRetired}
              onToggleShowRetired={() => setShowRetired(v => !v)}
              onEditInAdmin={song => { setAdminOpenSongId(song.id); setTab('admin') }}
              onSongUpdate={updated => {
                handleSongUpdate(updated)
                setSetList(prev => prev.map(item => item.song.id === updated.id ? { ...item, song: updated } : item))
              }}
              onRetire={async (song) => {
                const newRetired = !song.is_retired
                if (newRetired && !confirm(`Retire "${song.title}"? It will be hidden from the library and suggestions.`)) return
                await axios.patch(`/api/songs/${song.id}`, { is_retired: newRetired })
                if (showRetired) {
                  setSongs(prev => prev.map(s => s.id === song.id ? { ...s, is_retired: newRetired } : s))
                } else {
                  setSongs(prev => prev.filter(s => s.id !== song.id))
                }
              }}
            />
          </div>

          {/* Right resize handle */}
          <div
            className="w-1 flex-shrink-0 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize"
            onMouseDown={e => {
              rightDrag.current = { startX: e.clientX, startWidth: rightWidth }
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
              e.preventDefault()
            }}
          />

          <div className="bg-white border-l border-gray-200 flex-shrink-0" style={{ width: rightWidth }}>
            <SetBuilder
              setList={setList}
              onRemove={removeFromSet}
              onReorder={setSetList}
              onUseAsAnchor={(song, arrangement) => { setSelectedSong(song); setSelectedArrangement(arrangement) }}
              onChangeArrangement={(songId, arrangement) =>
                setSetList(prev => prev.map(item => item.song.id === songId ? { ...item, arrangement } : item))
              }
              onClearAll={() => setSetList([])}
              onSongUpdate={updated => {
                handleSongUpdate(updated)
                setSetList(prev => prev.map(item => item.song.id === updated.id ? { ...item, song: updated } : item))
              }}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-hidden">
          <AdminPanel onSongUpdate={handleSongUpdate} onSongAdd={handleSongAdd} onSongsReload={handleSongsReload} onLabelRename={handleLabelRename} openSongId={adminOpenSongId} />
        </div>
      )}

      {/* Feedback button */}
      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-4 right-4 z-40 text-xs bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-400 px-3 py-1.5 rounded-full shadow-sm transition-colors"
      >
        Feedback
      </button>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </div>
  )
}
