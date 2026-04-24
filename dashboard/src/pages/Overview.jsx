import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CONFIGS, CONCEPT_LABELS, CONCEPT_TOOLTIPS, MODE_NAMES, MODE_TOOLTIPS,
  WORLD_STATE_TOOLTIPS, PRICE_OF_AGGRESSION_TOOLTIP,
} from '../utils/constants'
import {
  worldStateDistribution, aggregatePayoffs, personaSnapshot,
} from '../utils/dataLoader'
import Tooltip from '../components/Tooltip'
import WorldStateBadge from '../components/WorldStateBadge'
import { ArrowRight, TrendingUp, Users, Globe, Calculator } from 'lucide-react'

const BTN = 'px-3 py-1.5 rounded text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900'
const BTN_ACTIVE = `${BTN} bg-gray-900 text-white`
const BTN_INACTIVE = `${BTN} text-gray-500 hover:text-gray-900`

export default function Overview({ data }) {
  const [concept, setConcept] = useState('maxmin')

  const coverage = data?.coverage || { standard: { done: 0, total: 25 }, cot: { done: 0, total: 25 } }

  const wsDist = useMemo(() => worldStateDistribution(data, 'standard', concept), [data, concept])
  const payoffs = useMemo(() => aggregatePayoffs(data, 'standard', concept), [data, concept])

  // Overall Price of Aggression: mean(maxmin) / mean(minmax) across all cells
  const priceOfAggression = useMemo(() => {
    const mm = aggregatePayoffs(data, 'standard', 'maxmin')
    const mn = aggregatePayoffs(data, 'standard', 'minmax')
    const a = mn.meanA !== 0 ? mm.meanA / mn.meanA : null
    const b = mn.meanB !== 0 ? mm.meanB / mn.meanB : null
    return { a, b }
  }, [data])

  const personaRows = useMemo(() => CONFIGS.map(c => ({
    config: c,
    snapshot: personaSnapshot(data, c.id, 'standard', concept),
  })), [data, concept])

  const topWs = useMemo(() => {
    const entries = Object.entries(wsDist.dist).sort((a, b) => b[1] - a[1])
    return entries[0] || null
  }, [wsDist])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-gray-500 text-sm mt-1">
          LLM agents play a two-stage cyber wargame across 25 matchups. Skim headline stats; click through for detail.
        </p>
      </header>

      {/* Concept toggle */}
      <div className="flex items-center gap-3" role="toolbar" aria-label="Concept selector">
        <div className="flex bg-gray-50 rounded-lg border border-gray-200 p-0.5" role="group">
          {['maxmin', 'minmax'].map(c => (
            <Tooltip key={c} content={CONCEPT_TOOLTIPS[c]}>
              <button aria-pressed={concept === c}
                onClick={() => setConcept(c)}
                className={concept === c ? BTN_ACTIVE : BTN_INACTIVE}>
                {CONCEPT_LABELS[c]}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Headline stats */}
      <section aria-label="Headline statistics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Simulations complete"
          tooltip="Number of standard (non-CoT) simulations loaded. Total = 5 × 5 personas."
        >
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-gray-900">{coverage.standard.done}</span>
            <span className="text-sm text-gray-400">/ {coverage.standard.total}</span>
          </div>
          <ProgressBar done={coverage.standard.done} total={coverage.standard.total} />
          <p className="text-xs text-gray-500 mt-1">
            CoT: {coverage.cot.done}/{coverage.cot.total}
          </p>
        </StatCard>

        <StatCard
          icon={<Globe className="w-4 h-4" />}
          label="Top world state"
          tooltip="Most common outcome across all matchups for the selected concept"
        >
          {topWs ? (
            <>
              <div className="mt-0.5">
                <Tooltip content={WORLD_STATE_TOOLTIPS[topWs[0]] || topWs[0]}>
                  <span className="cursor-help"><WorldStateBadge state={topWs[0]} /></span>
                </Tooltip>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                {topWs[1]} of {wsDist.covered} matchups
              </p>
            </>
          ) : <span className="text-gray-300 text-sm">No data</span>}
        </StatCard>

        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Avg payoff"
          tooltip="Mean meta-game payoff across all matchups"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-mono text-gray-900">A: {payoffs.meanA.toFixed(3)}</span>
            <span className="text-sm font-mono text-gray-600">B: {payoffs.meanB.toFixed(3)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">n = {payoffs.n}</p>
        </StatCard>

        <StatCard
          icon={<Calculator className="w-4 h-4" />}
          label={
            <Tooltip content={PRICE_OF_AGGRESSION_TOOLTIP}>
              <span className="cursor-help">Price of Aggression (λ)</span>
            </Tooltip>
          }
          tooltip={PRICE_OF_AGGRESSION_TOOLTIP}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-mono text-gray-900">A: {fmtLambda(priceOfAggression.a)}</span>
            <span className="text-sm font-mono text-gray-600">B: {fmtLambda(priceOfAggression.b)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">λ &gt; 1 favors defense</p>
        </StatCard>
      </section>

      {/* Persona snapshots */}
      <section className="border border-gray-200 rounded-lg overflow-hidden" aria-label="Persona snapshots">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Persona snapshots (Country A perspective)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Each row: that persona as Country A across all 5 opponents. Click to explore its full row in Matchups.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th scope="col" className="text-left py-2 px-4 text-xs text-gray-400 font-medium">Persona</th>
                <th scope="col" className="text-center py-2 px-4 text-xs text-gray-400 font-medium">Coverage</th>
                <th scope="col" className="text-center py-2 px-4 text-xs text-gray-400 font-medium">Avg A payoff</th>
                <th scope="col" className="text-center py-2 px-4 text-xs text-gray-400 font-medium">Most-picked mode</th>
                <th scope="col" className="text-center py-2 px-4 text-xs text-gray-400 font-medium">Most common outcome</th>
                <th scope="col" className="py-2 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {personaRows.map(({ config, snapshot }) => (
                <tr key={config.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 px-4">
                    <Tooltip content={config.description}>
                      <div className="flex items-center gap-2 cursor-help">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} aria-hidden="true" />
                        <span className="text-xs font-medium text-gray-900">{config.name}</span>
                        <span className="text-xs text-gray-400">({config.short})</span>
                      </div>
                    </Tooltip>
                  </td>
                  <td className="text-center py-2.5 px-4">
                    <span className="text-xs font-mono text-gray-600">
                      {snapshot ? `${snapshot.covered}/${snapshot.total}` : '—'}
                    </span>
                  </td>
                  <td className="text-center py-2.5 px-4 font-mono text-xs text-gray-700">
                    {snapshot?.meanPayoff !== null && snapshot?.meanPayoff !== undefined
                      ? snapshot.meanPayoff.toFixed(4)
                      : '—'}
                  </td>
                  <td className="text-center py-2.5 px-4">
                    {snapshot?.topMode ? (
                      <Tooltip content={MODE_TOOLTIPS[snapshot.topMode]}>
                        <span className="cursor-help text-xs font-medium text-gray-800">
                          {MODE_NAMES[snapshot.topMode]} ({snapshot.topMode})
                        </span>
                      </Tooltip>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="text-center py-2.5 px-4">
                    {snapshot?.topWorldState ? (
                      <Tooltip content={WORLD_STATE_TOOLTIPS[snapshot.topWorldState] || snapshot.topWorldState}>
                        <span className="cursor-help inline-block"><WorldStateBadge state={snapshot.topWorldState} /></span>
                      </Tooltip>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <Link
                      to={`/matchups?a=${config.id}&b=${config.id}&concept=${concept}`}
                      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-900"
                    >
                      Explore <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* World state distribution */}
      <section className="border border-gray-200 rounded-lg p-4" aria-label="World state distribution">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">World-state distribution</h2>
        <WorldStateDonut dist={wsDist.dist} total={wsDist.covered} />
        <p className="text-xs text-gray-400 mt-3">
          Across {wsDist.covered} completed matchups for {CONCEPT_LABELS[concept]}.
        </p>
      </section>

      {/* Crosslink to other tabs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to={`/matchups?concept=${concept}`}
          className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors group">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Matchups →</div>
              <div className="text-xs text-gray-500 mt-0.5">Explore all 25 simulations</div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
          </div>
        </Link>
        <Link to={`/reasoning?concept=${concept}`}
          className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors group">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Reasoning →</div>
              <div className="text-xs text-gray-500 mt-0.5">
                See how Chain-of-Thought changes decisions ({coverage.cot.done}/{coverage.cot.total} complete)
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
          </div>
        </Link>
      </section>
    </div>
  )
}

function StatCard({ icon, label, tooltip, children }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-1.5">
        <span className="text-gray-400">{icon}</span>
        {typeof label === 'string' ? (
          tooltip ? <Tooltip content={tooltip}><span className="cursor-help">{label}</span></Tooltip> : label
        ) : label}
      </div>
      {children}
    </div>
  )
}

function ProgressBar({ done, total }) {
  const pct = total > 0 ? (done / total) * 100 : 0
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-2">
      <div className="h-full bg-gray-900 transition-all" style={{ width: `${pct}%` }} aria-hidden="true" />
    </div>
  )
}

function WorldStateDonut({ dist, total }) {
  if (!total) return <p className="text-xs text-gray-400">No data yet.</p>

  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1])
  // Simple segmented bar chart (donut-like visual without SVG overhead)
  const colors = {
    'Mutual Deterrence': '#64748b',
    'Mutual Conflict': '#111827',
  }
  const getColor = (label) => colors[label] || '#d97706'

  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100" role="img" aria-label="World state distribution">
        {entries.map(([state, count]) => {
          const pct = (count / total) * 100
          return (
            <Tooltip key={state} content={`${state}: ${count}/${total} (${pct.toFixed(0)}%)`}>
              <div
                style={{ width: `${pct}%`, backgroundColor: getColor(state) }}
                className="h-full cursor-help"
                aria-hidden="true"
              />
            </Tooltip>
          )
        })}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {entries.map(([state, count]) => (
          <li key={state} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: getColor(state) }} aria-hidden="true" />
            <Tooltip content={WORLD_STATE_TOOLTIPS[state] || state}>
              <span className="text-gray-700 cursor-help">{state}</span>
            </Tooltip>
            <span className="ml-auto font-mono text-gray-500">{count}/{total}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function fmtLambda(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—'
  return v.toFixed(3)
}
