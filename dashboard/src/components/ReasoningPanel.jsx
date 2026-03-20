import { useState, useId } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export default function ReasoningPanel({ reasoningA, reasoningB, label }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  if (!reasoningA && !reasoningB) return null

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      >
        <span className="text-xs text-gray-700">{label || 'Chain-of-Thought Reasoning'}</span>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" aria-hidden="true" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" aria-hidden="true" />
        }
      </button>
      {open && (
        <div id={panelId} className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:divide-x divide-gray-200">
          <div className="p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Country A</div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{reasoningA || 'No reasoning recorded'}</pre>
          </div>
          <div className="p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Country B</div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{reasoningB || 'No reasoning recorded'}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
