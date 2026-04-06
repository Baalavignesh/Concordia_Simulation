import { useState, useMemo } from 'react'
import { CONFIGS, CROSSPLAY_MATCHUPS, CONCEPT_LABELS, SUBGAME_KEYS, MODE_NAMES, getConfigById } from '../utils/constants'
import WorldStateBadge from '../components/WorldStateBadge'
import MetaGameMatrix from '../components/MetaGameMatrix'
import ReasoningPanel from '../components/ReasoningPanel'

const BTN = 'px-3 py-2 rounded text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900'
const BTN_ACTIVE = `${BTN} bg-gray-900 text-white`
const BTN_INACTIVE = `${BTN} text-gray-500 hover:text-gray-900`

export default function CrossPlay({ data }) {
  const crossplay = data.__crossplay || {}
  const availableMatchups = useMemo(
    () => CROSSPLAY_MATCHUPS.filter(m => crossplay[m.id]),
    [crossplay]
  )

  const [selectedMatchup, setSelectedMatchup] = useState(availableMatchups[0]?.id || null)
  const [concept, setConcept] = useState('maxmin')
  const [selectedRun, setSelectedRun] = useState(0)

  if (availableMatchups.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Cross-Play Results</h1>
          <p className="text-gray-500 text-sm mt-1">Asymmetric matchups between different agent personas</p>
        </header>
        <div className="border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500 text-sm">No cross-play data available yet.</p>
          <p className="text-gray-400 text-xs mt-2">
            Run: <code className="bg-gray-100 px-1.5 py-0.5 rounded">python3 main.py --cross-play --runs 5</code>
          </p>
        </div>
      </div>
    )
  }

  const matchupData = selectedMatchup ? crossplay[selectedMatchup] : null
  const matchupInfo = CROSSPLAY_MATCHUPS.find(m => m.id === selectedMatchup)
  const configA = matchupInfo ? getConfigById(matchupInfo.config_a) : null
  const configB = matchupInfo ? getConfigById(matchupInfo.config_b) : null

  const conceptData = matchupData?.[concept]
  const runs = conceptData?.runs || []
  const currentRun = runs[selectedRun]

  // Build the heatmap matrix: rows = A configs, cols = B configs
  const heatmapData = useMemo(() => {
    const matrix = {}
    for (const matchup of availableMatchups) {
      const d = crossplay[matchup.id]
      if (!d?.[concept]?.runs?.length) continue
      const run = d[concept].runs[0]
      if (!matrix[matchup.config_a]) matrix[matchup.config_a] = {}
      matrix[matchup.config_a][matchup.config_b] = {
        payoffA: run.meta_game.payoff_a,
        payoffB: run.meta_game.payoff_b,
        matchupId: matchup.id,
      }
    }
    return matrix
  }, [availableMatchups, crossplay, concept])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Cross-Play Results</h1>
        <p className="text-gray-500 text-sm mt-1">
          Asymmetric matchups: different cognitive profiles playing against each other
        </p>
      </header>

      {/* Concept selector */}
      <div className="flex items-center gap-3" role="toolbar" aria-label="View controls">
        <div className="flex bg-gray-50 rounded-lg border border-gray-200 p-0.5" role="group" aria-label="Solution concept">
          {['maxmin', 'minmax'].map(c => (
            <button key={c} onClick={() => { setConcept(c); setSelectedRun(0) }}
              aria-pressed={concept === c}
              className={concept === c ? BTN_ACTIVE : BTN_INACTIVE}>
              {CONCEPT_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap matrix */}
      {Object.keys(heatmapData).length > 0 && (
        <section className="border border-gray-200 rounded-lg p-4" aria-label="Cross-play payoff matrix">
          <h2 className="text-sm font-medium text-gray-900 mb-3">
            Payoff Matrix (A's payoff shown)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">A \ B</th>
                  {CONFIGS.map(c => (
                    <th key={c.id} className="text-center py-2 px-3 text-xs text-gray-400 font-medium">{c.short}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CONFIGS.map(rowCfg => (
                  <tr key={rowCfg.id} className="border-t border-gray-50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rowCfg.color }} aria-hidden="true" />
                        <span className="text-xs font-medium text-gray-700">{rowCfg.short}</span>
                      </div>
                    </td>
                    {CONFIGS.map(colCfg => {
                      if (rowCfg.id === colCfg.id) {
                        return <td key={colCfg.id} className="text-center py-2 px-3 text-xs text-gray-300">--</td>
                      }
                      const cell = heatmapData[rowCfg.id]?.[colCfg.id]
                      if (!cell) {
                        return <td key={colCfg.id} className="text-center py-2 px-3 text-xs text-gray-300">--</td>
                      }
                      const isSelected = selectedMatchup === cell.matchupId
                      return (
                        <td key={colCfg.id} className="text-center py-1 px-1">
                          <button
                            onClick={() => { setSelectedMatchup(cell.matchupId); setSelectedRun(0) }}
                            className={`w-full px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                              isSelected
                                ? 'bg-gray-900 text-white'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            {cell.payoffA.toFixed(3)}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">Click a cell to view matchup details. Rows = Country A persona, Columns = Country B persona.</p>
        </section>
      )}

      {/* Selected matchup detail */}
      {matchupInfo && matchupData && (
        <section className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm text-gray-900">{matchupInfo.fullName}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: configA?.color }} />
                    A: {configA?.name}
                  </span>
                  {' vs '}
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: configB?.color }} />
                    B: {configB?.name}
                  </span>
                </p>
              </div>
              {runs.length > 1 && (
                <div className="flex bg-white rounded-lg border border-gray-200 p-0.5" role="group" aria-label="Run selector">
                  {runs.map((_, i) => (
                    <button key={i} onClick={() => setSelectedRun(i)}
                      aria-pressed={selectedRun === i}
                      className={selectedRun === i ? BTN_ACTIVE : BTN_INACTIVE}>
                      Run {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Stats row */}
            {currentRun && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Stat label="A Payoff" value={currentRun.meta_game.payoff_a.toFixed(4)} sublabel={configA?.short} />
                <Stat label="B Payoff" value={currentRun.meta_game.payoff_b.toFixed(4)} sublabel={configB?.short} />
                <Stat label="A Mode" value={MODE_NAMES[currentRun.meta_game.mode_a]} sublabel={currentRun.meta_game.mode_a} />
                <Stat label="B Mode" value={MODE_NAMES[currentRun.meta_game.mode_b]} sublabel={currentRun.meta_game.mode_b} />
                <Stat label="World State" value={<WorldStateBadge state={currentRun.world_state} />} />
              </div>
            )}

            {/* Subgame results table */}
            {currentRun && (
              <>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-xs font-medium text-gray-700">Subgame Results (Run {selectedRun + 1})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th scope="col" className="text-left py-2 px-4 text-xs text-gray-400 font-medium">Subgame</th>
                          <th scope="col" className="text-center py-2 px-4 text-xs text-gray-400 font-medium">
                            A Action ({configA?.short})
                          </th>
                          <th scope="col" className="text-center py-2 px-4 text-xs text-gray-400 font-medium">
                            B Action ({configB?.short})
                          </th>
                          <th scope="col" className="text-center py-2 px-4 text-xs text-gray-400 font-medium">A Payoff</th>
                          <th scope="col" className="text-center py-2 px-4 text-xs text-gray-400 font-medium">B Payoff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SUBGAME_KEYS.map(key => {
                          const sg = currentRun.subgames[key]
                          return (
                            <tr key={key} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 px-4 font-mono font-bold text-gray-900">{key}</td>
                              <td className="text-center py-2 px-4">
                                <ActionBadge action={sg.action_a} />
                              </td>
                              <td className="text-center py-2 px-4">
                                <ActionBadge action={sg.action_b} />
                              </td>
                              <td className="text-center py-2 px-4 font-mono text-xs text-gray-700">{sg.payoff_a.toFixed(4)}</td>
                              <td className="text-center py-2 px-4 font-mono text-xs text-gray-700">{sg.payoff_b.toFixed(4)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <MetaGameMatrix metaGame={currentRun.meta_game} runIndex={selectedRun} />

                {/* Chain-of-Thought reasoning (shown when available) */}
                {SUBGAME_KEYS.some(key => currentRun.subgames[key].reasoning_a || currentRun.subgames[key].reasoning_b) && (
                  <section aria-label="Chain-of-thought reasoning">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Reasoning</h3>
                    <div className="space-y-2">
                      {SUBGAME_KEYS.map(key => {
                        const sg = currentRun.subgames[key]
                        return (
                          <ReasoningPanel
                            key={key}
                            reasoningA={sg.reasoning_a}
                            reasoningB={sg.reasoning_b}
                            label={`${key} — ${MODE_NAMES[key[0]]} vs ${MODE_NAMES[key[1]]}`}
                          />
                        )
                      })}
                      <ReasoningPanel
                        reasoningA={currentRun.meta_game.reasoning_a}
                        reasoningB={currentRun.meta_game.reasoning_b}
                        label="Meta-Game Decision"
                      />
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, sublabel }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
        {label} {sublabel && <span className="text-gray-300">({sublabel})</span>}
      </div>
      <div className="text-lg font-bold font-mono text-gray-900">{value}</div>
    </div>
  )
}

function ActionBadge({ action }) {
  const isAttack = action === 'R'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${isAttack ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
      {isAttack ? 'ATK' : 'THR'}
    </span>
  )
}
