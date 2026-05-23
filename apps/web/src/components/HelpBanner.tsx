import { useState } from 'react'

interface Props {
  id: string
  text: string
}

export default function HelpBanner({ id, text }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(`help-${id}`) === '0' } catch { return false }
  })

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(`help-${id}`, next ? '0' : '1') } catch {}
  }

  if (collapsed) {
    return (
      <div className="border-b border-gray-100 flex justify-end px-3 py-1">
        <button onClick={toggle} className="text-xs text-gray-300 hover:text-gray-500 select-none">
          ? tips
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-2.5 bg-yellow-50 border-b border-yellow-100 text-xs text-gray-500 leading-relaxed flex gap-2 items-start">
      <span className="flex-1">{text}</span>
      <button
        onClick={toggle}
        className="text-gray-300 hover:text-gray-400 flex-shrink-0 ml-2 text-base leading-none"
        title="Collapse"
      >
        ×
      </button>
    </div>
  )
}
