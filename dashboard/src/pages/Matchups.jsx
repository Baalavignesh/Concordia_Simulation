import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  CONFIGS, CONCEPT_LABELS, CONCEPT_TOOLTIPS, SUBGAME_KEYS, MODE_NAMES,
  MODE_TOOLTIPS, ACTION_TOOLTIPS, WORLD_STATE_TOOLTIPS, subgameTooltip,
} from '../utils/constants'
import { getMatchup, firstRun, cellSummary, listMatchups } from '../utils/dataLoader'
import Tooltip from '../components/Tooltip'
import MetaGameMatrix from '../components/MetaGameMatrix'
import WorldStateBadge from '../components/WorldStateBadge'
import { ArrowRight, Sparkles } from 'lucide-react'

const BTN = 'px-3 py-1.5 rounded text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900'
const BTN_ACTIVE = `${BTN} bg-gray-900 text-white`
const BTN_INACTIVE = `${BTN} text-gray-500 hover:text-gray-900`

export default function Matchups({ data }) {
  const [searchParams, setSearchParams] = useSearchParams()

  const concept = searchParams.get('concept') || 'maxmin'
  const view = searchParams.get('view') || 'payoff'  // 'payoff' | 'world'
  const matchupA = searchParams.get('a') || null
  const matchupB = searchParams.get('b') || null

  const setParam = (k, v) => {
    const next = new URLSearchParams(searchParams)
    if (v === null || v === undefined) next.delete(k)
    else next.set(k, v)
    setSearchParams(next, { replace: true })
  }

  const selectedCell = matchupA && matchupB ? getMatchup(data, matchupA, matchupB) : null

  // Auto-select first available cell if none selected
  useEffect(() => {
    if (matchupA && matchupB) return
    const first = listMatchups(data).find(({ cell }) => cell.coverage.standard)
    if (first) {
      const next = new URLSearchParams(searchParams)
      next.set('a', first.configA.id)
      next.set('b', first.configB.id)
      setSearchParams(next, { replace: true })
    }
  }, [data, matchupA, matchupB, searchParams, setSearchParams])

  // Compute payoff range for heatmap normalization
  const { minPayoff, maxPayoff } = useMemo(() => {
    let min = Infinity, max = -Infinity
    for (const { cell } of listMatchups(data)) {
      const run = firstRun(cell, 'standard', concept)
      if (!run) continue
      min = Math.min(min, run.meta_game.payoff_a)
      max = Math.max(max, run.meta_game.payoff_a)
    }
    if (min === Infinity) { min = 0; max = 0 }
    return { minPayoff: min, maxPayoff: max }
  }, [data, concept])

  const coverage = data?.coverage?.standard || { done: 0, total: 25 }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Matchups</h1>
        <p className="text-gray-500 text-sm mt-1">
          Every combination of Country A and Country B personas. Click any cell to inspect that matchup.
        </p>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="Matchup view controls">
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

        <ToggleGroup label="Cell view">
          {[{ k: 'payoff', l: 'Payoff' }, { k: 'world', l: 'World state' }].map(v => (
            <button key={v.k} aria-pressed={view === v.k}
              onClick={() => setParam('view', v.k)}
              className={view === v.k ? BTN_ACTIVE : BTN_INACTIVE}>
              {v.l}
            </button>
          ))}
        </ToggleGroup>

        <div className="ml-auto text-xs text-gray-500">
          Coverage: <strong className="text-gray-900">{coverage.done}/{coverage.total}</strong> simulations
        </div>
      </div>

      {/* 5x5 Matrix */}
      <section className="border border-gray-200 rounded-lg overflow-hidden" aria-label="5x5 matchup matrix">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {view === 'payoff' ? "Country A's payoff by matchup" : 'World-state outcome by matchup'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Rows = Country A persona · Columns = Country B persona · Diagonal cells are symmetric (both agents share persona)
            </p>
          </div>
        </div>

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
                  {CONFIGS.map(colCfg => (
                    <MatrixCell
                      key={colCfg.id}
                      data={data}
                      rowCfg={rowCfg}
                      colCfg={colCfg}
                      concept={concept}
                      view={view}
                      minPayoff={minPayoff}
                      maxPayoff={maxPayoff}
                      isSelected={rowCfg.id === matchupA && colCfg.id === matchupB}
                      onSelect={() => {
                        const next = new URLSearchParams(searchParams)
                        next.set('a', rowCfg.id)
                        next.set('b', colCfg.id)
                        setSearchParams(next, { replace: true })
                      }}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drill-down — keyed on cell identity so internal state resets cleanly on selection */}
      {selectedCell && (
        <MatchupDetail
          key={`${selectedCell.configA.id}__${selectedCell.configB.id}`}
          cell={selectedCell}
          concept={concept}
        />
      )}
    </div>
  )
}

function ToggleGroup({ label, children }) {
  return (
    <div className="flex bg-gray-50 rounded-lg border border-gray-200 p-0.5" role="group" aria-label={label}>
      {children}
    </div>
  )
}

function MatrixCell({ data, rowCfg, colCfg, concept, view, minPayoff, maxPayoff, isSelected, onSelect }) {
  const cell = getMatchup(data, rowCfg.id, colCfg.id)
  const summary = cellSummary(cell, 'standard', concept)
  const isDiagonal = rowCfg.id === colCfg.id
  const hasCot = cell?.coverage.cot

  if (!summary) {
    return (
      <td className="text-center py-1 px-0.5">
        <Tooltip content="No data yet — simulation not run">
          <span className="inline-block w-full px-2 py-2 text-xs text-gray-300 cursor-help">–</span>
        </Tooltip>
      </td>
    )
  }

  let bgStyle = {}
  let textClass = 'text-gray-800'
  let cellContent = null

  if (view === 'payoff') {
    // Diverging color scale: red for negative, green for positive
    const range = Math.max(Math.abs(minPayoff), Math.abs(maxPayoff), 1)
    const normalized = summary.payoffA / range  // -1 .. 1
    if (normalized >= 0) {
      const intensity = Math.min(normalized, 1)
      bgStyle = { backgroundColor: `rgba(16, 185, 129, ${intensity * 0.25})` }
    } else {
      const intensity = Math.min(-normalized, 1)
      bgStyle = { backgroundColor: `rgba(244, 63, 94, ${intensity * 0.25})` }
    }
    cellContent = <span className="font-mono text-xs">{summary.payoffA.toFixed(3)}</span>
  } else {
    // World-state view
    const wsStyle = {
      'Mutual Deterrence': { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Det' },
      'Mutual Conflict': { bg: 'bg-gray-900', text: 'text-white', label: 'Con' },
    }[summary.worldState] || { bg: 'bg-amber-50', text: 'text-amber-800', label: 'Asym' }
    cellContent = (
      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${wsStyle.bg} ${wsStyle.text}`}>
        {wsStyle.label}
      </span>
    )
  }

  const tooltipContent = (
    <>
      <div className="font-semibold mb-0.5">{rowCfg.short} (A) vs {colCfg.short} (B)</div>
      <div>A payoff: {summary.payoffA.toFixed(4)}</div>
      <div>B payoff: {summary.payoffB.toFixed(4)}</div>
      <div>A mode: {summary.modeA} · B mode: {summary.modeB}</div>
      <div className="mt-1 opacity-90">{summary.worldState}</div>
      {hasCot && <div className="mt-1 italic opacity-80">CoT also available</div>}
      {isDiagonal && <div className="mt-1 italic opacity-80">Symmetric (A=B config)</div>}
    </>
  )

  return (
    <td className="text-center py-0.5 px-0.5">
      <Tooltip content={tooltipContent} maxWidth={220}>
        <button
          onClick={onSelect}
          style={bgStyle}
          className={`w-full min-w-[3.5rem] px-2 py-2 rounded transition-all ${textClass} ${
            isSelected ? 'ring-2 ring-gray-900 ring-offset-1' : 'hover:ring-1 hover:ring-gray-400 hover:ring-offset-1'
          } ${isDiagonal ? 'border border-dashed border-gray-300' : ''}`}
        >
          {cellContent}
        </button>
      </Tooltip>
    </td>
  )
}

function MatchupDetail({ cell, concept }) {
  // Init from cell coverage — component is remounted (via `key` prop) when
  // selection changes, so this picks the correct default for each new cell.
  const initialSource = cell.coverage.standard ? 'standard' : (cell.coverage.cot ? 'cot' : 'standard')
  const [source, setSource] = useState(initialSource)
  const [reasoningOpen, setReasoningOpen] = useState(false)

  const run = firstRun(cell, source, concept)
  if (!run) {
    return (
      <section className="border border-gray-200 rounded-lg p-8 text-center" aria-label="Matchup detail">
        <p className="text-sm text-gray-500">No data for this matchup + concept combination yet.</p>
      </section>
    )
  }

  const { configA, configB, isSymmetric } = cell
  const hasCot = cell.coverage.cot

  return (
    <section className="border border-gray-200 rounded-lg overflow-hidden" aria-label="Matchup detail">
      <header className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div>
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
            {isSymmetric && (
              <Tooltip content="Both agents use the same persona">
                <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs cursor-help">Symmetric</span>
              </Tooltip>
            )}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {hasCot && (
            <ToggleGroup label="Data source">
              <button onClick={() => setSource('standard')}
                aria-pressed={source === 'standard'}
                className={source === 'standard' ? BTN_ACTIVE : BTN_INACTIVE}>
                Standard
              </button>
              <button onClick={() => setSource('cot')}
                aria-pressed={source === 'cot'}
                className={source === 'cot' ? BTN_ACTIVE : BTN_INACTIVE}>
                Chain-of-Thought
              </button>
            </ToggleGroup>
          )}
          {hasCot && (
            <Link
              to={`/reasoning?a=${configA.id}&b=${configB.id}&concept=${concept}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            >
              <Sparkles className="w-3 h-3" /> View reasoning
            </Link>
          )}
          {!hasCot && (
            <Tooltip content="CoT simulation for this matchup not run yet">
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-dashed border-gray-200 cursor-help">
                CoT coming soon
              </span>
            </Tooltip>
          )}
        </div>
      </header>

      <div className="p-4 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Stat label="A Payoff" value={run.meta_game.payoff_a.toFixed(4)} sublabel={configA.short} />
          <Stat label="B Payoff" value={run.meta_game.payoff_b.toFixed(4)} sublabel={configB.short} />
          <Stat
            label="A Mode"
            value={
              <Tooltip content={MODE_TOOLTIPS[run.meta_game.mode_a]}>
                <span className="cursor-help">{MODE_NAMES[run.meta_game.mode_a]}</span>
              </Tooltip>
            }
            sublabel={run.meta_game.mode_a}
          />
          <Stat
            label="B Mode"
            value={
              <Tooltip content={MODE_TOOLTIPS[run.meta_game.mode_b]}>
                <span className="cursor-help">{MODE_NAMES[run.meta_game.mode_b]}</span>
              </Tooltip>
            }
            sublabel={run.meta_game.mode_b}
          />
          <Stat
            label="World State"
            value={
              <Tooltip content={WORLD_STATE_TOOLTIPS[run.world_state] || run.world_state}>
                <span className="cursor-help"><WorldStateBadge state={run.world_state} /></span>
              </Tooltip>
            }
          />
        </div>

        {/* Subgame table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <h3 className="text-xs font-medium text-gray-700">9 Subgames</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th scope="col" className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Subgame</th>
                  <th scope="col" className="text-center py-2 px-3 text-xs text-gray-400 font-medium">A Action</th>
                  <th scope="col" className="text-center py-2 px-3 text-xs text-gray-400 font-medium">B Action</th>
                  <th scope="col" className="text-center py-2 px-3 text-xs text-gray-400 font-medium">A Payoff</th>
                  <th scope="col" className="text-center py-2 px-3 text-xs text-gray-400 font-medium">B Payoff</th>
                </tr>
              </thead>
              <tbody>
                {SUBGAME_KEYS.map(key => {
                  const sg = run.subgames[key]
                  return (
                    <tr key={key} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-1.5 px-3 font-mono font-bold text-gray-900">
                        <Tooltip content={subgameTooltip(key)}>
                          <span className="cursor-help">{key}</span>
                        </Tooltip>
                      </td>
                      <td className="text-center py-1.5 px-3"><ActionBadge action={sg.action_a} /></td>
                      <td className="text-center py-1.5 px-3"><ActionBadge action={sg.action_b} /></td>
                      <td className="text-center py-1.5 px-3 font-mono text-xs text-gray-700">{sg.payoff_a.toFixed(4)}</td>
                      <td className="text-center py-1.5 px-3 font-mono text-xs text-gray-700">{sg.payoff_b.toFixed(4)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Meta-game */}
        <MetaGameMatrix metaGame={run.meta_game} />

        {/* Inline reasoning if CoT source active */}
        {source === 'cot' && (
          <details
            className="border border-gray-200 rounded-lg"
            open={reasoningOpen}
            onToggle={e => setReasoningOpen(e.currentTarget.open)}
          >
            <summary className="px-3 py-2 bg-gray-50 border-b border-gray-100 cursor-pointer text-xs font-medium text-gray-700 list-none flex items-center justify-between">
              <span>Reasoning traces ({SUBGAME_KEYS.length} subgames + meta)</span>
              <span className="text-gray-400">{reasoningOpen ? 'Hide' : 'Show'}</span>
            </summary>
            <div className="p-3 space-y-2">
              <p className="text-xs text-gray-400">
                For detailed reasoning analysis across all matchups, see the{' '}
                <Link to={`/reasoning?a=${configA.id}&b=${configB.id}&concept=${concept}`} className="underline text-gray-700">
                  Reasoning tab
                </Link>.
              </p>
              {SUBGAME_KEYS.map(key => {
                const sg = run.subgames[key]
                if (!sg.reasoning_a && !sg.reasoning_b) return null
                return <ReasoningExcerpt key={key} label={`Subgame ${key}`} a={sg.reasoning_a} b={sg.reasoning_b} />
              })}
              <ReasoningExcerpt label="Meta-game decision" a={run.meta_game.reasoning_a} b={run.meta_game.reasoning_b} />
            </div>
          </details>
        )}
      </div>
    </section>
  )
}

function ReasoningExcerpt({ label, a, b }) {
  return (
    <details className="border border-gray-100 rounded">
      <summary className="px-2.5 py-1.5 bg-white hover:bg-gray-50 text-xs text-gray-600 cursor-pointer list-none flex items-center justify-between">
        <span>{label}</span>
        <ArrowRight className="w-3 h-3 text-gray-400" aria-hidden="true" />
      </summary>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        <div className="p-2.5">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">A</div>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{a || '—'}</pre>
        </div>
        <div className="p-2.5">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">B</div>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{b || '—'}</pre>
        </div>
      </div>
    </details>
  )
}

function Stat({ label, value, sublabel }) {
  return (
    <div className="border border-gray-200 rounded-lg p-2.5">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
        {label} {sublabel && <span className="text-gray-300">({sublabel})</span>}
      </div>
      <div className="text-base font-bold font-mono text-gray-900">{value}</div>
    </div>
  )
}

function ActionBadge({ action }) {
  const isAttack = action === 'R'
  return (
    <Tooltip content={ACTION_TOOLTIPS[action]}>
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold cursor-help ${isAttack ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
        {isAttack ? 'ATK' : 'THR'}
      </span>
    </Tooltip>
  )
}
