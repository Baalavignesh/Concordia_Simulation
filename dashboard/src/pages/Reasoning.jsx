import { useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  CONFIGS, CONCEPT_LABELS, CONCEPT_TOOLTIPS, SUBGAME_KEYS, MODE_NAMES,
  MODE_TOOLTIPS, ACTION_TOOLTIPS, METRIC_LABELS, METRIC_TOOLTIPS,
  subgameTooltip, WORLD_STATE_TOOLTIPS,
} from '../utils/constants'
import { getMatchup, firstRun, listMatchups, divergence } from '../utils/dataLoader'
import Tooltip from '../components/Tooltip'
import WorldStateBadge from '../components/WorldStateBadge'
import ReasoningPanel from '../components/ReasoningPanel'
import { Sparkles } from 'lucide-react'

const BTN = 'px-3 py-1.5 rounded text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900'
const BTN_ACTIVE = `${BTN} bg-gray-900 text-white`
const BTN_INACTIVE = `${BTN} text-gray-500 hover:text-gray-900`

const CHART_TICK = { fill: '#6b7280', fontSize: 12 }
const CHART_TOOLTIP_STYLE = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', color: '#111827', fontSize: 12 }

const COT_METRICS = [
  'avg_reasoning_length',
  'avg_opponent_modeling',
  'dominance_recognition_rate',
  'avg_hedge_count',
  'avg_comparison_count',
]

export default function Reasoning({ data }) {
  const [searchParams, setSearchParams] = useSearchParams()

  const concept = searchParams.get('concept') || 'maxmin'
  const metric = searchParams.get('metric') || 'avg_reasoning_length'
  const matchupA = searchParams.get('a') || null
  const matchupB = searchParams.get('b') || null

  const setParam = (k, v) => {
    const next = new URLSearchParams(searchParams)
    if (v === null || v === undefined) next.delete(k)
    else next.set(k, v)
    setSearchParams(next, { replace: true })
  }

  const selectedCell = matchupA && matchupB ? getMatchup(data, matchupA, matchupB) : null

  // Auto-select the first matchup with CoT data if none selected
  useEffect(() => {
    if (matchupA && matchupB) return
    const first = listMatchups(data).find(({ cell }) => cell.coverage.cot)
    if (first) {
      const next = new URLSearchParams(searchParams)
      next.set('a', first.configA.id)
      next.set('b', first.configB.id)
      setSearchParams(next, { replace: true })
    }
  }, [data, matchupA, matchupB, searchParams, setSearchParams])

  // Divergence data: for each cell with BOTH standard + CoT, compute divergence
  const divergenceData = useMemo(() => {
    const rows = []
    for (const { configA, configB, cell } of listMatchups(data)) {
      const div = divergence(cell, concept)
      if (!div) continue
      rows.push({
        label: cell.isSymmetric ? configA.short : `${configA.short}×${configB.short}`,
        name: `${configA.name} vs ${configB.name}`,
        isSymmetric: cell.isSymmetric,
        rate: div.rate,
        different: div.different,
        total: div.total,
        color: cell.isSymmetric ? configA.color : '#64748b',
      })
    }
    return rows
  }, [data, concept])

  const cotCoverage = data?.coverage?.cot || { done: 0, total: 25 }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gray-500" aria-hidden="true" />
          Reasoning
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          How Chain-of-Thought changes LLM decisions, and what reasoning looks like per persona.
        </p>
      </header>

      {cotCoverage.done === 0 && (
        <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">No Chain-of-Thought data yet</h2>
          <p className="text-xs text-gray-500 mt-1">
            Run simulations with the <code className="bg-gray-100 px-1 rounded">--cot</code> flag to populate this tab.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="Reasoning view controls">
        <ToggleGroup label="Solution concept">
          {['maxmin', 'minmax'].map(c => (
            <Tooltip key={c} content={CONCEPT_TOOLTIPS[c]}>
              <button aria-pressed={concept === c}
                onClick={() => setParam('concept', c)}
                className={concept === c ? BTN_ACTIVE : BTN_INACTIVE}>
                {CONCEPT_LABELS[c]}
              </button>
            </Tooltip>
          ))}
        </ToggleGroup>

        <ToggleGroup label="Complexity metric">
          {COT_METRICS.map(m => (
            <Tooltip key={m} content={METRIC_TOOLTIPS[m]}>
              <button aria-pressed={metric === m}
                onClick={() => setParam('metric', m)}
                className={metric === m ? BTN_ACTIVE : BTN_INACTIVE}>
                {METRIC_LABELS[m]}
              </button>
            </Tooltip>
          ))}
        </ToggleGroup>

        <div className="ml-auto text-xs text-gray-500">
          CoT coverage: <strong className="text-gray-900">{cotCoverage.done}/{cotCoverage.total}</strong>
        </div>
      </div>

      {/* Divergence chart */}
      <section className="border border-gray-200 rounded-lg p-4" aria-label="Decision divergence between standard and CoT">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">Did CoT change the decision?</h2>
          <span className="text-xs text-gray-400">
            % of 20 decisions per matchup that flipped with CoT enabled
          </span>
        </div>
        {divergenceData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={divergenceData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} unit="%" domain={[0, 100]} />
              <ReTooltip contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(val, _, props) => [`${val}% (${props.payload.different}/${props.payload.total})`, 'Divergence']}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label}
              />
              <Bar dataKey="rate" name="Divergence" radius={[3, 3, 0, 0]}>
                {divergenceData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState label="Divergence needs both Standard and CoT data for the same matchup. Waiting on CoT runs." />
        )}
      </section>

      {/* 5x5 Reasoning complexity matrix */}
      <section className="border border-gray-200 rounded-lg overflow-hidden" aria-label="Reasoning complexity matrix">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">{METRIC_LABELS[metric]} — by matchup</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Darker cell = higher metric value. Cells without CoT show "soon".
          </p>
        </div>
        <ComplexityMatrix data={data} metric={metric} concept={concept}
          selectedA={matchupA} selectedB={matchupB}
          onSelect={(a, b) => {
            const next = new URLSearchParams(searchParams)
            next.set('a', a)
            next.set('b', b)
            setSearchParams(next, { replace: true })
          }} />
      </section>

      {/* Subgame complexity heatmap (symmetric only — from cot_complexity_analysis.json) */}
      {data?.cotAnalysis?.configs && (
        <section className="border border-gray-200 rounded-lg overflow-hidden" aria-label="Per-subgame complexity">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Subgame-level complexity (symmetric runs)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Average reasoning length per subgame, by persona. Darker = more words.
            </p>
          </div>
          <SubgameHeatmap cotAnalysis={data.cotAnalysis} concept={concept} />
        </section>
      )}

      {/* Drill-down: std vs CoT for selected matchup */}
      {selectedCell && selectedCell.coverage.cot && (
        <MatchupReasoningDetail cell={selectedCell} concept={concept} />
      )}
      {selectedCell && !selectedCell.coverage.cot && (
        <section className="border border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">
            CoT reasoning for {selectedCell.configA.short} vs {selectedCell.configB.short} coming soon
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            This matchup's Chain-of-Thought simulation hasn't been run yet.
          </p>
        </section>
      )}
    </div>
  )
}

function ToggleGroup({ label, children }) {
  return (
    <div className="flex bg-gray-50 rounded-lg border border-gray-200 p-0.5 flex-wrap" role="group" aria-label={label}>
      {children}
    </div>
  )
}

function EmptyState({ label }) {
  return (
    <div className="text-center py-8">
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}

// ------------------------------------------------------------------
// 5x5 complexity matrix
// ------------------------------------------------------------------

function ComplexityMatrix({ data, metric, concept, selectedA, selectedB, onSelect }) {
  // Gather raw metric values to normalize opacity
  const cellValues = useMemo(() => {
    const values = []
    const byCell = {}
    for (const a of CONFIGS) {
      byCell[a.id] = {}
      for (const b of CONFIGS) {
        const cell = getMatchup(data, a.id, b.id)
        const v = extractMetricValue(cell, metric, concept, data?.cotAnalysis)
        byCell[a.id][b.id] = v
        if (v !== null) values.push(v)
      }
    }
    const max = values.length ? Math.max(...values, 1) : 1
    return { byCell, max }
  }, [data, metric, concept])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th scope="col" className="text-left py-2 px-3 text-xs text-gray-400 font-medium">A \ B</th>
            {CONFIGS.map(c => (
              <th key={c.id} scope="col" className="text-center py-2 px-2 text-xs text-gray-500 font-medium">
                <Tooltip content={`${c.name} — ${c.description}`}>
                  <span className="inline-flex items-center gap-1 cursor-help">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
                    {c.short}
                  </span>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CONFIGS.map(rowCfg => (
            <tr key={rowCfg.id} className="border-t border-gray-100">
              <td className="py-2 px-3 text-xs text-gray-700 font-medium whitespace-nowrap">
                <Tooltip content={`${rowCfg.name} — ${rowCfg.description}`}>
                  <span className="inline-flex items-center gap-1.5 cursor-help">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rowCfg.color }} aria-hidden="true" />
                    {rowCfg.short}
                  </span>
                </Tooltip>
              </td>
              {CONFIGS.map(colCfg => {
                const v = cellValues.byCell[rowCfg.id][colCfg.id]
                const isSelected = rowCfg.id === selectedA && colCfg.id === selectedB

                if (v === null) {
                  return (
                    <td key={colCfg.id} className="text-center py-1 px-0.5">
                      <Tooltip content="CoT simulation not run yet">
                        <span className="inline-block w-full px-2 py-2 text-xs text-gray-300 italic cursor-help">soon</span>
                      </Tooltip>
                    </td>
                  )
                }

                const opacity = 0.1 + Math.min(v / cellValues.max, 1) * 0.75
                const fmt = metric === 'dominance_recognition_rate'
                  ? `${Math.round(v * 100)}%`
                  : typeof v === 'number' ? v.toFixed(v < 10 ? 1 : 0) : String(v)

                return (
                  <td key={colCfg.id} className="text-center py-0.5 px-0.5">
                    <Tooltip content={
                      <>
                        <div className="font-semibold mb-0.5">{rowCfg.short} (A) vs {colCfg.short} (B)</div>
                        <div>{METRIC_LABELS[metric]}: <strong>{fmt}</strong></div>
                      </>
                    }>
                      <button
                        onClick={() => onSelect(rowCfg.id, colCfg.id)}
                        className={`w-full min-w-[3.5rem] px-2 py-2 rounded font-mono text-xs transition-all ${
                          isSelected ? 'ring-2 ring-gray-900 ring-offset-1' : 'hover:ring-1 hover:ring-gray-400'
                        }`}
                        style={{
                          backgroundColor: `rgba(17, 24, 39, ${opacity})`,
                          color: opacity > 0.45 ? '#fff' : '#374151',
                        }}
                      >
                        {fmt}
                      </button>
                    </Tooltip>
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

/**
 * Extract a complexity metric value for a given cell + concept.
 * For symmetric cells, prefer the pre-computed cot_complexity_analysis.json if available.
 * For crossplay cells or as a fallback, compute from the raw CoT run (averaged over subgames).
 */
function extractMetricValue(cell, metric, concept, cotAnalysis) {
  if (!cell?.coverage.cot) return null

  // Symmetric: try cot_complexity_analysis.json first (richer)
  if (cell.isSymmetric && cotAnalysis?.cross_config_comparison) {
    const v = cotAnalysis.cross_config_comparison[cell.configA.id]?.[concept]?.[metric]
    if (v !== undefined && v !== null) return v
  }

  // Fallback: compute from raw CoT run (crossplay or symmetric without analysis file)
  const cotSim = cell.cot
  const run = cotSim?.[concept]?.runs?.[0]
  if (!run) return null

  // cot_complexity is embedded in each concept's block (from analysis.py).
  const embed = cotSim[concept]?.cot_complexity
  if (embed) {
    return readEmbeddedMetric(embed, metric)
  }

  return null
}

function readEmbeddedMetric(embed, metric) {
  // Embed structure: { subgames: {PP: {A:{word_count:{mean,std}, ...}, B:{...}}, ...}, meta_game: {A,B}, complexity_ranking: [...] }
  // Aggregate over all 9 subgames + meta for A and B both.
  const collectAll = (accessor) => {
    const vals = []
    for (const key of SUBGAME_KEYS) {
      const sg = embed.subgames?.[key]
      if (!sg) continue
      const a = accessor(sg.A)
      const b = accessor(sg.B)
      if (typeof a === 'number') vals.push(a)
      if (typeof b === 'number') vals.push(b)
    }
    const meta = embed.meta_game
    if (meta) {
      const a = accessor(meta.A)
      const b = accessor(meta.B)
      if (typeof a === 'number') vals.push(a)
      if (typeof b === 'number') vals.push(b)
    }
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }

  switch (metric) {
    case 'avg_reasoning_length':
      return collectAll(player => player?.word_count?.mean)
    case 'avg_opponent_modeling':
      return collectAll(player => player?.opponent_mentions?.mean)
    case 'dominance_recognition_rate':
      return collectAll(player => typeof player?.recognizes_dominance === 'number' ? player.recognizes_dominance : null)
    case 'avg_hedge_count':
      return collectAll(player => player?.hedge_count?.mean)
    case 'avg_comparison_count':
      return collectAll(player => player?.comparison_count?.mean)
    default:
      return null
  }
}

// ------------------------------------------------------------------
// Subgame heatmap (symmetric configs, from cot_complexity_analysis.json)
// ------------------------------------------------------------------

function SubgameHeatmap({ cotAnalysis, concept }) {
  const rows = useMemo(() => {
    return (cotAnalysis.configs || []).map(c => {
      const cfg = CONFIGS.find(x => x.id === c.config)
      const d = c.concepts?.[concept]
      return { cfg, subgames: d?.subgames }
    }).filter(r => r.cfg && r.subgames)
  }, [cotAnalysis, concept])

  if (rows.length === 0) {
    return <EmptyState label="No subgame-level CoT data for this concept yet." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th scope="col" className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Persona</th>
            {SUBGAME_KEYS.map(k => (
              <th key={k} scope="col" className="text-center py-2 px-2 text-xs text-gray-500 font-medium">
                <Tooltip content={subgameTooltip(k)}>
                  <span className="cursor-help">{k}</span>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cfg, subgames }) => {
            const avgs = SUBGAME_KEYS.map(k => {
              const sg = subgames[k]
              return sg ? (sg.A.word_count.mean + sg.B.word_count.mean) / 2 : 0
            })
            const maxAvg = Math.max(...avgs, 1)
            return (
              <tr key={cfg.id} className="border-t border-gray-100">
                <td className="py-2 px-3 text-xs text-gray-700 whitespace-nowrap">
                  <Tooltip content={cfg.description}>
                    <span className="inline-flex items-center gap-1.5 cursor-help">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                      {cfg.short}
                    </span>
                  </Tooltip>
                </td>
                {SUBGAME_KEYS.map((k, i) => {
                  const avg = avgs[i]
                  const opacity = 0.1 + (avg / maxAvg) * 0.75
                  return (
                    <td key={k} className="text-center py-0.5 px-0.5">
                      <Tooltip content={`${cfg.short}, ${subgameTooltip(k)} — avg ${avg.toFixed(0)} words`}>
                        <span className="inline-block rounded px-1.5 py-1 font-mono text-xs cursor-help"
                          style={{ backgroundColor: `rgba(17, 24, 39, ${opacity})`, color: opacity > 0.45 ? '#fff' : '#374151' }}>
                          {avg.toFixed(0)}
                        </span>
                      </Tooltip>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------------
// Drill-down: Standard vs CoT decision diff + reasoning traces
// ------------------------------------------------------------------

function MatchupReasoningDetail({ cell, concept }) {
  const stdRun = firstRun(cell, 'standard', concept)
  const cotRun = firstRun(cell, 'cot', concept)
  const { configA, configB } = cell

  const diffs = useMemo(() => {
    if (!stdRun || !cotRun) return null
    const rows = []
    for (const key of SUBGAME_KEYS) {
      const s = stdRun.subgames[key], c = cotRun.subgames[key]
      const aChanged = s.action_a !== c.action_a
      const bChanged = s.action_b !== c.action_b
      if (aChanged || bChanged) {
        rows.push({
          subgame: key,
          aStd: s.action_a, aCot: c.action_a, aChanged,
          bStd: s.action_b, bCot: c.action_b, bChanged,
        })
      }
    }
    const metaAChanged = stdRun.meta_game.mode_a !== cotRun.meta_game.mode_a
    const metaBChanged = stdRun.meta_game.mode_b !== cotRun.meta_game.mode_b
    return { rows, metaAChanged, metaBChanged }
  }, [stdRun, cotRun])

  if (!cotRun) return null

  return (
    <section className="border border-gray-200 rounded-lg overflow-hidden" aria-label="Matchup reasoning detail">
      <header className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: configA.color }} />
            {configA.name}
          </span>
          <span className="text-gray-400">vs</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: configB.color }} />
            {configB.name}
          </span>
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Chain-of-Thought — {CONCEPT_LABELS[concept]}</p>
      </header>

      <div className="p-4 space-y-5">
        {/* Std vs CoT diff */}
        {stdRun && diffs && (
          <div className="border border-gray-200 rounded-lg">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xs font-medium text-gray-700">Decisions that changed with CoT</h3>
              <span className="text-xs text-gray-400">
                {diffs.rows.length} subgames · meta A: {diffs.metaAChanged ? 'changed' : 'same'}, B: {diffs.metaBChanged ? 'changed' : 'same'}
              </span>
            </div>
            {diffs.rows.length === 0 && !diffs.metaAChanged && !diffs.metaBChanged ? (
              <p className="text-xs text-gray-400 p-3">CoT did not change any decision for this matchup.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th scope="col" className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Subgame</th>
                      <th scope="col" className="text-center py-2 px-3 text-xs text-gray-400 font-medium">A: Std → CoT</th>
                      <th scope="col" className="text-center py-2 px-3 text-xs text-gray-400 font-medium">B: Std → CoT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.rows.map(row => (
                      <tr key={row.subgame} className="border-b border-gray-50">
                        <td className="py-1.5 px-3 font-mono font-bold text-gray-900">
                          <Tooltip content={subgameTooltip(row.subgame)}>
                            <span className="cursor-help">{row.subgame}</span>
                          </Tooltip>
                        </td>
                        <td className="text-center py-1.5 px-3">
                          <TransitionBadge from={row.aStd} to={row.aCot} changed={row.aChanged} />
                        </td>
                        <td className="text-center py-1.5 px-3">
                          <TransitionBadge from={row.bStd} to={row.bCot} changed={row.bChanged} />
                        </td>
                      </tr>
                    ))}
                    {(diffs.metaAChanged || diffs.metaBChanged) && (
                      <tr className="bg-gray-50/50">
                        <td className="py-1.5 px-3 font-mono font-bold text-gray-900 text-xs">META</td>
                        <td className="text-center py-1.5 px-3 font-mono text-xs">
                          {diffs.metaAChanged
                            ? <ModeTransition from={stdRun.meta_game.mode_a} to={cotRun.meta_game.mode_a} />
                            : <span className="text-gray-400">same ({stdRun.meta_game.mode_a})</span>}
                        </td>
                        <td className="text-center py-1.5 px-3 font-mono text-xs">
                          {diffs.metaBChanged
                            ? <ModeTransition from={stdRun.meta_game.mode_b} to={cotRun.meta_game.mode_b} />
                            : <span className="text-gray-400">same ({stdRun.meta_game.mode_b})</span>}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Outcome summary side-by-side */}
        {stdRun && (
          <div className="grid grid-cols-2 gap-3">
            <OutcomeCard label="Standard outcome" run={stdRun} />
            <OutcomeCard label="CoT outcome" run={cotRun} dark />
          </div>
        )}

        {/* Reasoning panels */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-700">Reasoning traces</h3>
          {SUBGAME_KEYS.map(key => {
            const sg = cotRun.subgames[key]
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
            reasoningA={cotRun.meta_game.reasoning_a}
            reasoningB={cotRun.meta_game.reasoning_b}
            label="Meta-game decision"
          />
        </div>
      </div>
    </section>
  )
}

function TransitionBadge({ from, to, changed }) {
  if (!changed) {
    return (
      <Tooltip content={ACTION_TOOLTIPS[from]}>
        <span className="text-xs text-gray-400 cursor-help">same ({from})</span>
      </Tooltip>
    )
  }
  return (
    <div className="inline-flex items-center gap-1 text-xs font-mono">
      <Tooltip content={ACTION_TOOLTIPS[from]}>
        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 cursor-help">{from}</span>
      </Tooltip>
      <span className="text-gray-300">→</span>
      <Tooltip content={ACTION_TOOLTIPS[to]}>
        <span className="px-1.5 py-0.5 rounded bg-gray-900 text-white cursor-help">{to}</span>
      </Tooltip>
    </div>
  )
}

function ModeTransition({ from, to }) {
  return (
    <div className="inline-flex items-center gap-1">
      <Tooltip content={MODE_TOOLTIPS[from]}>
        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 cursor-help">{from}</span>
      </Tooltip>
      <span className="text-gray-300">→</span>
      <Tooltip content={MODE_TOOLTIPS[to]}>
        <span className="px-1.5 py-0.5 rounded bg-gray-900 text-white cursor-help">{to}</span>
      </Tooltip>
    </div>
  )
}

function OutcomeCard({ label, run, dark }) {
  return (
    <div className={`border rounded-lg p-3 ${dark ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200'}`}>
      <div className={`text-xs uppercase tracking-wider mb-2 ${dark ? 'text-gray-400' : 'text-gray-400'}`}>{label}</div>
      <div className="text-xs space-y-1">
        <div>Modes: <strong className="font-mono">{run.meta_game.mode_a} / {run.meta_game.mode_b}</strong></div>
        <div>Payoffs: <span className="font-mono">{run.meta_game.payoff_a.toFixed(3)} / {run.meta_game.payoff_b.toFixed(3)}</span></div>
        <div className="pt-1">
          <Tooltip content={WORLD_STATE_TOOLTIPS[run.world_state] || run.world_state}>
            <span className={`cursor-help ${dark ? 'inline-block px-2 py-0.5 rounded bg-white/10 text-white' : ''}`}>
              {dark ? run.world_state : <WorldStateBadge state={run.world_state} />}
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
