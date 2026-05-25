import type { ClientFilters } from '../types'

interface Props {
  availableLabels: string[]
  activeSources: string[]
  onToggle: (label: string) => void
  withinYears: string
  onWithinYearsChange: (val: string) => void
  pcoOnly: boolean
  onPcoOnlyChange: (val: boolean) => void
  includeUnlabeled: boolean
  onIncludeUnlabeledChange: (val: boolean) => void
  clientFilters: ClientFilters
  onClientFiltersChange: (f: ClientFilters) => void
  availableKeys: string[]
  availableThemes: string[]
  width?: number
}

export default function SourceFilter({
  availableLabels, activeSources, onToggle,
  withinYears, onWithinYearsChange,
  pcoOnly, onPcoOnlyChange,
  includeUnlabeled, onIncludeUnlabeledChange,
  clientFilters, onClientFiltersChange,
  availableKeys, availableThemes,
  width = 208,
}: Props) {
  const f = clientFilters
  const set = (patch: Partial<ClientFilters>) => onClientFiltersChange({ ...f, ...patch })
  const toggle = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

  const wide = width >= 280
  const wider = width >= 340

  const sectionHeader = (label: string, onClear?: () => void) => (
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      {onClear && (
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600">clear</button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">

      {/* RELEASE DATE */}
      <div className="p-3 border-b border-gray-200">
        {sectionHeader('Release Date')}
        <select
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
          value={withinYears}
          onChange={e => onWithinYearsChange(e.target.value)}
        >
          <option value="">All time</option>
          <option value="5">Last 5 years</option>
          <option value="10">Last 10 years</option>
          <option value="15">Last 15 years</option>
        </select>
      </div>

      {/* PLANNING CENTER */}
      <div className="p-3 border-b border-gray-200">
        {sectionHeader('Planning Center')}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => onPcoOnlyChange(!pcoOnly)}
            className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-left text-xs transition-colors ${
              pcoOnly ? 'bg-purple-50 text-purple-700 border border-purple-300' : 'bg-gray-50 text-gray-500 border border-gray-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pcoOnly ? 'bg-purple-500' : 'bg-gray-300'}`} />
            PCO songs only
          </button>
          <div>
            <div className="text-xs text-gray-500 mb-1">Last used</div>
            <select
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
              value={f.pcoNotUsedMonths}
              onChange={e => set({ pcoNotUsedMonths: e.target.value === '' ? '' : parseInt(e.target.value) })}
            >
              <option value="">Any time</option>
              <option value="3">3+ months ago</option>
              <option value="6">6+ months ago</option>
              <option value="12">12+ months ago</option>
              <option value="24">2+ years ago</option>
            </select>
          </div>
        </div>
      </div>

      {/* KEYS */}
      {availableKeys.length > 0 && (
        <div className="p-3 border-b border-gray-200">
          {sectionHeader('Keys', f.keys.length > 0 ? () => set({ keys: [] }) : undefined)}
          {wide ? (
            <div className="flex flex-col gap-2">
              {(['Major', 'Minor'] as const).map(mode => {
                const keys = mode === 'Major'
                  ? availableKeys.filter(k => !k.endsWith('m'))
                  : availableKeys.filter(k => k.endsWith('m'))
                if (!keys.length) return null
                return (
                  <div key={mode}>
                    <div className="text-xs text-gray-400 mb-1">{mode}</div>
                    <div className="flex flex-wrap gap-1">
                      {keys.map(key => (
                        <button key={key} onClick={() => set({ keys: toggle(f.keys, key) })}
                          className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${f.keys.includes(key) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {availableKeys.map(key => (
                <button key={key} onClick={() => set({ keys: toggle(f.keys, key) })}
                  className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${f.keys.includes(key) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                  {key}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BPM RANGE */}
      <div className="p-3 border-b border-gray-200">
        {sectionHeader('BPM Range', (f.bpmMin !== '' || f.bpmMax !== '') ? () => set({ bpmMin: '', bpmMax: '' }) : undefined)}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            placeholder="Min"
            value={f.bpmMin}
            min={1} max={300}
            onChange={e => set({ bpmMin: e.target.value === '' ? '' : parseInt(e.target.value) })}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white min-w-0"
          />
          <span className="text-gray-400 text-xs flex-shrink-0">—</span>
          <input
            type="number"
            placeholder="Max"
            value={f.bpmMax}
            min={1} max={300}
            onChange={e => set({ bpmMax: e.target.value === '' ? '' : parseInt(e.target.value) })}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white min-w-0"
          />
        </div>
      </div>

      {/* ENERGY */}
      <div className="p-3 border-b border-gray-200">
        {sectionHeader('Energy', f.energy.length > 0 ? () => set({ energy: [] }) : undefined)}
        <div className="flex gap-1">
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              onClick={() => set({ energy: toggle(f.energy, n) })}
              title={['Very soft','Gentle','Moderate','Energetic','Very high'][n-1]}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                f.energy.includes(n)
                  ? 'bg-sky-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* THEOLOGICAL DEPTH */}
      <div className="p-3 border-b border-gray-200">
        {sectionHeader('Depth', f.theologicalDepth.length > 0 ? () => set({ theologicalDepth: [] }) : undefined)}
        <div className="flex gap-1">
          {[1,2,3].map(n => (
            <button
              key={n}
              onClick={() => set({ theologicalDepth: toggle(f.theologicalDepth, n) })}
              title={['Accessible','Moderate','Deep'][n-1]}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                f.theologicalDepth.includes(n)
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* THEMES */}
      {availableThemes.length > 0 && (
        <div className="p-3 border-b border-gray-200">
          {sectionHeader('Themes', f.themes.length > 0 ? () => set({ themes: [] }) : undefined)}
          <div className={`gap-1 max-h-40 overflow-y-auto ${wider ? 'grid grid-cols-2' : 'flex flex-col'}`}>
            {availableThemes.map(theme => (
              <button
                key={theme}
                onClick={() => set({ themes: toggle(f.themes, theme) })}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-xs transition-colors ${
                  f.themes.includes(theme)
                    ? 'bg-violet-50 text-violet-700 border border-violet-300'
                    : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.themes.includes(theme) ? 'bg-violet-500' : 'bg-gray-300'}`} />
                {theme}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SOURCES */}
      <div className="p-3">
        {sectionHeader('Sources')}
        <div className={`gap-1.5 ${wider ? 'grid grid-cols-2' : 'flex flex-col'}`}>
          <button
            onClick={() => onIncludeUnlabeledChange(!includeUnlabeled)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-xs transition-colors ${
              includeUnlabeled
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-gray-50 text-gray-400 border border-gray-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${includeUnlabeled ? 'bg-blue-500' : 'bg-gray-300'}`} />
            Include unlabeled
          </button>
          {availableLabels.map(label => (
            <button
              key={label}
              onClick={() => onToggle(label)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-xs transition-colors ${
                activeSources.includes(label)
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeSources.includes(label) ? 'bg-blue-500' : 'bg-gray-300'}`} />
              {label}
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
