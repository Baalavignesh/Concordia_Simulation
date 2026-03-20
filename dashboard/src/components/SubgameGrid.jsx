import { Fragment } from 'react'
import { MODE_NAMES } from '../utils/constants'

export default function SubgameGrid({ runs }) {
  if (!runs?.length) return null

  const subgameKeys = ['PP', 'PS', 'PC', 'SP', 'SS', 'SC', 'CP', 'CS', 'CC']

  return (
    <div className="border border-gray-200 rounded-lg p-4 overflow-x-auto">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Subgame Actions & Payoffs</h3>
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th scope="col" className="text-left py-2 px-2 text-gray-500">Subgame</th>
            <th scope="col" className="text-left py-2 px-2 text-gray-500 hidden sm:table-cell">Modes</th>
            {runs.map((_, i) => (
              <th key={i} scope="col" className="text-center py-2 px-2 text-gray-500" colSpan={2}>
                Run {i + 1}
              </th>
            ))}
          </tr>
          <tr className="border-b border-gray-100">
            <th scope="col"><span className="sr-only">Subgame key</span></th>
            <th scope="col" className="hidden sm:table-cell"><span className="sr-only">Mode matchup</span></th>
            {runs.map((_, i) => (
              <Fragment key={i}>
                <th scope="col" className="text-center py-1 px-1 text-gray-500 text-xs">A</th>
                <th scope="col" className="text-center py-1 px-1 text-gray-500 text-xs">B</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {subgameKeys.map(key => (
            <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-2 font-mono font-bold text-gray-900">{key}</td>
              <td className="py-2 px-2 text-gray-500 hidden sm:table-cell">
                {MODE_NAMES[key[0]]} vs {MODE_NAMES[key[1]]}
              </td>
              {runs.map((run, i) => {
                const sg = run.subgames[key]
                return (
                  <Fragment key={i}>
                    <td className="text-center py-2 px-1">
                      <ActionBadge action={sg.action_a} payoff={sg.payoff_a} />
                    </td>
                    <td className="text-center py-2 px-1">
                      <ActionBadge action={sg.action_b} payoff={sg.payoff_b} />
                    </td>
                  </Fragment>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActionBadge({ action, payoff }) {
  const isAttack = action === 'R'
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`px-2 py-1 rounded text-xs font-bold ${isAttack ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
        {isAttack ? 'ATK' : 'THR'}
      </span>
      <span className={`font-mono text-xs ${payoff >= 0 ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
        {payoff.toFixed(2)}
      </span>
    </div>
  )
}
