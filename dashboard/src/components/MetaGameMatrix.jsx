import { MODE_NAMES, MODES } from '../utils/constants'

export default function MetaGameMatrix({ metaGame, runIndex }) {
  if (!metaGame) return null

  const { meta_matrix_a, meta_matrix_b, mode_a, mode_b, payoff_a, payoff_b } = metaGame

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-medium text-gray-900">
          Meta-Game {runIndex !== undefined ? `(Run ${runIndex + 1})` : ''}
        </h3>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>A chose: <strong className="text-gray-900">{MODE_NAMES[mode_a]}</strong></span>
          <span>B chose: <strong className="text-gray-900">{MODE_NAMES[mode_b]}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MatrixTable matrix={meta_matrix_a} label="Country A Payoffs" chosenRow={MODES.indexOf(mode_a)} chosenCol={MODES.indexOf(mode_b)} />
        <MatrixTable matrix={meta_matrix_b} label="Country B Payoffs" chosenRow={MODES.indexOf(mode_a)} chosenCol={MODES.indexOf(mode_b)} />
      </div>

      <div className="mt-3 flex gap-4 text-xs">
        <div className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
          A Payoff: <span className="font-mono font-bold text-gray-900">{payoff_a.toFixed(4)}</span>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
          B Payoff: <span className="font-mono font-bold text-gray-900">{payoff_b.toFixed(4)}</span>
        </div>
      </div>
    </div>
  )
}

function MatrixTable({ matrix, label, chosenRow, chosenCol }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <table className="w-full text-xs sm:text-sm font-mono" aria-label={label}>
        <thead>
          <tr>
            <th scope="col" className="p-1.5 text-gray-400"><span className="sr-only">Row mode</span></th>
            {MODES.map(m => (
              <th key={m} scope="col" className="p-1.5 text-gray-500 text-center" aria-label={MODE_NAMES[m]}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODES.map((m, i) => (
            <tr key={m}>
              <th scope="row" className="p-1.5 text-gray-500 font-bold" aria-label={MODE_NAMES[m]}>{m}</th>
              {matrix[i].map((val, j) => {
                const isChosen = i === chosenRow && j === chosenCol
                return (
                  <td key={`${i}-${j}`} className={`p-1.5 text-center rounded ${isChosen ? 'bg-gray-900 text-white font-bold' : ''} ${!isChosen && val < 0 ? 'text-gray-900 font-semibold' : !isChosen ? 'text-gray-600' : ''}`}>
                    {val.toFixed(2)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
