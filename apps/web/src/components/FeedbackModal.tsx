import { useState } from 'react'
import axios from 'axios'

const TYPES = ['Bug report', 'Feature suggestion', 'General feedback'] as const
type FeedbackType = typeof TYPES[number]

interface Props {
  onClose: () => void
}

export default function FeedbackModal({ onClose }: Props) {
  const [type, setType] = useState<FeedbackType>('Feature suggestion')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (message.trim().length < 5) { setError('Please enter a bit more detail.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await axios.post('/api/feedback', { type, message: message.trim() })
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Send feedback</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            <p className="text-green-600 font-medium mb-1">Thanks for the feedback!</p>
            <p className="text-sm text-gray-500">It's been sent through.</p>
            <button onClick={onClose} className="mt-4 text-sm text-gray-500 hover:text-gray-700">Close</button>
          </div>
        ) : (
          <div className="px-6 py-5 flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Type</label>
              <div className="flex gap-2 flex-wrap">
                {TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      type === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Message</label>
              <textarea
                autoFocus
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe the issue or idea..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
