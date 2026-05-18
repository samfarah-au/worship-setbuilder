import { useState, useEffect } from 'react'
import axios from 'axios'
import type { Song, SuggestionResult } from './types'
import { SOURCE_LABELS } from './types'
import SongList from './components/SongList'
import SetBuilder from './components/SetBuilder'
import SourceFilter from './components/SourceFilter'
import AdminPanel from './components/AdminPanel'

type Tab = 'library' | 'admin'

export default function App() {
  const [tab, setTab] = useState<Tab>('library')
  const [songs, setSongs] = useState<Song[]>([])
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([])
  const [setList, setSetList] = useState<Song[]>([])
  const [activeSources, setActiveSources] = useState<string[]>([...SOURCE_LABELS])
  const [withinYears, setWithinYears] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Fetch songs when filters change
  useEffect(() => {
    const params: Record<string, string> = {}
    if (activeSources.length < SOURCE_LABELS.length) {
      params.source_label = activeSources.join(',')
    }
    if (withinYears) params.within_years = withinYears

    axios.get('/api/songs', { params })
      .then(res => setSongs(res.data))
      .catch(console.error)
  }, [activeSources, withinYears])

  // Fetch suggestions when anchor song changes
  useEffect(() => {
    if (!selectedSong) return

    const params: Record<string, string> = {}
    if (activeSources.length < SOURCE_LABELS.length) {
      params.source_label = activeSources.join(',')
    }
    if (withinYears) params.within_years = withinYears

    const fetchSuggestions = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`/api/songs/${selectedSong.id}/suggestions`, { params })
        setSuggestions(res.data.suggestions)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchSuggestions()
  }, [selectedSong, activeSources, withinYears])

  const addToSet = (song: Song) => {
    if (!setList.find(s => s.id === song.id)) {
      setSetList(prev => [...prev, song])
    }
  }

  const removeFromSet = (songId: string) => {
    setSetList(prev => prev.filter(s => s.id !== songId))
  }

  const addPairToSet = (suggestion: Song) => {
    if (!selectedSong) return
    setSetList(prev => {
      const withoutBoth = prev.filter(s => s.id !== selectedSong.id && s.id !== suggestion.id)
      return [...withoutBoth, selectedSong, suggestion]
    })
  }

  return (
    <div className="flex h-screen bg-gray-100 text-sm overflow-hidden">
      {/* Left: Sidebar */}
      <div className="w-52 bg-white border-r border-gray-200 flex flex-col">
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
            activeSources={activeSources}
            onToggle={(label) => setActiveSources(prev =>
              prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]
            )}
            withinYears={withinYears}
            onWithinYearsChange={setWithinYears}
          />
        )}
      </div>

      {/* Main content */}
      {tab === 'library' ? (
        <>
          {/* Middle: Song list + suggestions */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <SongList
              songs={songs}
              selectedSong={selectedSong}
              onSelectAnchor={setSelectedSong}
              onClearAnchor={() => setSelectedSong(null)}
              suggestions={suggestions}
              loading={loading}
              onAddToSet={addToSet}
              onAddPairToSet={addPairToSet}
              search={search}
              onSearchChange={setSearch}
            />
          </div>

          {/* Right: Set builder */}
          <div className="w-72 bg-white border-l border-gray-200">
            <SetBuilder
              setList={setList}
              onRemove={removeFromSet}
              onReorder={setSetList}
              onUseAsAnchor={setSelectedSong}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-hidden">
          <AdminPanel />
        </div>
      )}
    </div>
  )
}