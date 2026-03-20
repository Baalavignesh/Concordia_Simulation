import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CONFIGS, CONCEPT_LABELS, SUBGAME_KEYS, MODE_NAMES, MODES } from '../utils/constants'
import { getRunStats, getWorldStateDistribution, getMetaModeDistribution } from '../utils/dataLoader'
import MetaGameMatrix from '../components/MetaGameMatrix'
import WorldStateBadge from '../components/WorldStateBadge'
import ReasoningPanel from '../components/ReasoningPanel'
import { ArrowLeft } from 'lucide-react'

const BTN = 'px-3 py-2 rounded text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900'
const BTN_ACTIVE = `${BTN} bg-gray-900 text-white`
const BTN_INACTIVE = `${BTN} text-gray-500 hover:text-gray-900`

export default function ConfigDetail({ data }) {
  const { configId } = useParams()
  const config = CONFIGS.find(c => c.id === configId)
  const [concept, setConcept] = useState('maxmin')
  const [dataMode, setDataMode] = useState('base')
  const [selectedRun, setSelectedRun] = useState(0)

  if (!config) return <div className="text-gray-500 p-8 text-center" role="alert">Config not found</div>

  const configData = data[configId]
  const source = dataMode === 'cot' && configData?.cot ? configData.cot : configData?.base
  if (!source) return <div className="text-gray-500 p-8 text-center" role="alert">No data available for {config.name}</div>

  const conceptData = source[concept]
  const hasCot = !!configData?.cot
  const runs = conceptData?.runs || []
  const stats = getRunStats(source, concept)
  const wsDist = getWorldStateDistribution(source, concept)
  const metaDist = getMetaModeDistribution(source, concept)
  const currentRun = runs[selectedRun]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" aria-label="Back to overview"
          className="text-gray-400 hover:text-gray-700 transition-colors rounded">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} aria-hidden="true" />
          <h1 className="text-xl font-bold text-gray-900">{config.name}</h1>
        </div>
        <span className="text-xs text-gray-500 hidden sm:inline">{config.description}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="View controls">
        <div className="flex bg-gray-50 rounded-lg border border-gray-200 p-0.5" role="group" aria-label="Solution concept">
          {['maxmin', 'minmax'].map(c => (
            <button key={c} onClick={() => { setConcept(c); setSelectedRun(0) }}
              aria-pressed={concept === c}
              className={concept === c ? BTN_ACTIVE : BTN_INACTIVE}>
              {CONCEPT_LABELS[c]}
            </button>
          ))}
        </div>

        {hasCot && (
          <div className="flex bg-gray-50 rounded-lg border border-gray-200 p-0.5" role="group" aria-label="Data mode">
            {[{ key: 'base', label: 'Standard' }, { key: 'cot', label: 'Chain-of-Thought' }].map(m => (
              <button key={m.key} onClick={() => { setDataMode(m.key); setSelectedRun(0) }}
                aria-pressed={dataMode === m.key}
                className={dataMode === m.key ? BTN_ACTIVE : BTN_INACTIVE}>
                {m.label}
              </button>
            ))}
          </div>
        )}

        {runs.length > 1 && (
          <div className="flex bg-gray-50 rounded-lg border border-gray-200 p-0.5" role="group" aria-label="Run selector">
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

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Runs" value={stats.numRuns} />
          <Stat label="A Mean Payoff" value={stats.meanPayoffA.toFixed(4)} />
          <Stat label="B Mean Payoff" value={stats.meanPayoffB.toFixed(4)} />
          {currentRun && <Stat label="World State" value={<WorldStateBadge state={currentRun.world_state} />} />}
        </div>
      )}

      {wsDist && metaDist && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-2">World State Distribution</h2>
            <div className="space-y-1.5">
              {Object.entries(wsDist.distribution).map(([state, count]) => (
                <div key={state} className="flex items-center justify-between text-sm">
                  <WorldStateBadge state={state} />
                  <span className="font-mono text-xs text-gray-600">{count}/{wsDist.total}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Meta-Game Mode Choices</h2>
            <div className="space-y-1">
              {MODES.map(m => (
                <div key={m} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">{MODE_NAMES[m]}</span>
                  <span className="font-mono text-gray-600">A:{metaDist.a[m]} B:{metaDist.b[m]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentRun && (
        <section className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-900">Subgame Results (Run {selectedRun + 1})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th scope="col" className="text-left py-2 px-4 text-xs text-gray-400 font-medium">Subgame</th>
                  <th scope="col" className="text-left py-2 px-4 text-xs text-gray-400 font-medium hidden sm:table-cell">Modes</th>
                  <th scope="col" className="text-center py-2 px-4 text-xs text-gray-400 font-medium">A Action</th>
                  <th scope="col" className="text-center py-2 px-4 text-xs text-gray-400 font-medium">B Action</th>
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
                      <td className="py-2 px-4 text-xs text-gray-500 hidden sm:table-cell">
                        {MODE_NAMES[key[0]]} vs {MODE_NAMES[key[1]]}
                      </td>
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
        </section>
      )}

      {currentRun && (
        <MetaGameMatrix metaGame={currentRun.meta_game} runIndex={selectedRun} />
      )}

      {dataMode === 'cot' && currentRun && (
        <section aria-label="Chain-of-thought reasoning">
          <h2 className="text-sm font-medium text-gray-900 mb-2">Reasoning (Run {selectedRun + 1})</h2>
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

      {conceptData?.analysis && (
        <section className="border border-gray-200 rounded-lg p-4" aria-label="Analysis text">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Analysis</h2>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
            {conceptData.analysis}
          </pre>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</div>
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
