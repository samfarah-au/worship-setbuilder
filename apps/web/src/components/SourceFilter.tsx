import { SOURCE_LABELS } from '../types'

interface Props {
  activeSources: string[]
  onToggle: (label: string) => void
  withinYears: string
  onWithinYearsChange: (val: string) => void
}

export default function SourceFilter({ activeSources, onToggle, withinYears, onWithinYearsChange }: Props) {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <div className="p-3 border-b border-gray-200">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
          Release Date
        </label>
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

      <div className="p-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
          Sources
        </label>
        <div className="flex flex-col gap-1.5">
          {SOURCE_LABELS.map(label => (
            <button
              key={label}
              onClick={() => onToggle(label)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-xs transition-colors ${
                activeSources.includes(label)
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                activeSources.includes(label) ? 'bg-blue-500' : 'bg-gray-300'
              }`} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}