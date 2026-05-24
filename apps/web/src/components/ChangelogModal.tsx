interface Release {
  version: string
  date: string
  notes: string[]
}

const RELEASES: Release[] = [
  {
    version: '0.1',
    date: '2026-05-24',
    notes: [
      'Initial beta release',
      'Song library with source, key, BPM, energy, and theme filters',
      'Anchor-based suggestion engine — ranks songs by key, tempo, energy, and theme compatibility',
      'Set builder with drag-and-drop reordering and flow analysis',
      'Arrangement switcher in the set builder',
      'In-app Spotify preview player',
      'PCO integration — import songs, sync last-used dates, and pick up new alternate keys',
      'Admin panel — edit song data, add songs, manage source labels, themes, and time signatures',
      'Copy set to clipboard',
      'Contextual help banners',
      'Feedback form',
    ],
  },
]

interface Props {
  onClose: () => void
}

export default function ChangelogModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Changelog</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
          {RELEASES.map(release => (
            <div key={release.version}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-semibold text-gray-800">v{release.version}</span>
                <span className="text-xs text-gray-400">{release.date}</span>
              </div>
              <ul className="flex flex-col gap-1">
                {release.notes.map((note, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-gray-300 flex-shrink-0">–</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
