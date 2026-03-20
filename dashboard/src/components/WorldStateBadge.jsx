const WORLD_STATE_STYLES = {
  'Mutual Deterrence': 'bg-gray-100 text-gray-700 border-gray-300',
  'Mutual Conflict': 'bg-gray-900 text-white border-gray-900',
}

export default function WorldStateBadge({ state }) {
  const style = WORLD_STATE_STYLES[state] || 'bg-gray-50 text-gray-600 border-gray-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${style}`}>
      {state}
    </span>
  )
}
