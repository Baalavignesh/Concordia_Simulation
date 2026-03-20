import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CONFIGS, CONCEPT_LABELS, SUBGAME_KEYS, MODE_NAMES } from '../utils/constants'
import { getRunStats } from '../utils/dataLoader'
import WorldStateBadge from '../components/WorldStateBadge'

const CHART_TICK = { fill: '#6b7280', fontSize: 12 }
const CHART_TOOLTIP = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', color: '#111827' }

export default function CotComparison({ data }) {
  const results = useMemo(() => CONFIGS.map(c => {
    const cd = data[c.id]
    if (!cd?.base || !cd?.cot) return null

    const concepts = ['maxmin', 'minmax'].map(concept => {
      const baseStats = getRunStats(cd.base, concept)
      const cotStats = getRunStats(cd.cot, concept)
      const bRuns = cd.base[concept]?.runs || []
      const cRuns = cd.cot[concept]?.runs || []
      const pairs = Math.min(bRuns.length, cRuns.length)

      let totalDecisions = 0
      let differentDecisions = 0
      const divergentSubgames = []

      for (let r = 0; r < pairs; r++) {
        SUBGAME_KEYS.forEach(key => {
          totalDecisions += 2
          if (bRuns[r].subgames[key].action_a !== cRuns[r].subgames[key].action_a) {
            differentDecisions++
            if (r === 0) divergentSubgames.push({ key, player: 'A', base: bRuns[r].subgames[key].action_a, cot: cRuns[r].subgames[key].action_a })
          }
          if (bRuns[r].subgames[key].action_b !== cRuns[r].subgames[key].action_b) {
            differentDecisions++
            if (r === 0) divergentSubgames.push({ key, player: 'B', base: bRuns[r].subgames[key].action_b, cot: cRuns[r].subgames[key].action_b })
          }
        })
        totalDecisions += 2
        if (bRuns[r].meta_game.mode_a !== cRuns[r].meta_game.mode_a) differentDecisions++
        if (bRuns[r].meta_game.mode_b !== cRuns[r].meta_game.mode_b) differentDecisions++
      }

      const baseWS = bRuns[0]?.world_state
      const cotWS = cRuns[0]?.world_state
      const baseMeta = bRuns[0]?.meta_game
      const cotMeta = cRuns[0]?.meta_game

      return {
        concept,
        baseStats,
        cotStats,
        divergenceRate: totalDecisions > 0 ? +((differentDecisions / totalDecisions) * 100).toFixed(1) : 0,
        different: differentDecisions,
        total: totalDecisions,
        baseWS, cotWS,
        baseMeta, cotMeta,
        metaChanged: baseMeta && cotMeta && (baseMeta.mode_a !== cotMeta.mode_a || baseMeta.mode_b !== cotMeta.mode_b),
        wsChanged: baseWS !== cotWS,
      }
    })

    return { config: c, concepts }
  }).filter(Boolean), [data])

  const divergenceChart = useMemo(() => results.map(r => ({
    name: r.config.short,
    color: r.config.color,
    maxmin: r.concepts[0].divergenceRate,
    minmax: r.concepts[1].divergenceRate,
  })), [results])

  if (results.length === 0) {
    return (
      <div className="text-gray-500 p-8 text-center" role="status">
        No configurations have both Standard and Chain-of-Thought data.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Standard vs Chain-of-Thought</h1>
        <p className="text-gray-500 text-sm mt-1">
          How step-by-step reasoning changes LLM decisions
        </p>
      </header>

      <section className="border border-gray-200 rounded-lg p-4" aria-label="Divergence rates">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Decision Divergence Rate</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={divergenceChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={CHART_TICK} />
            <YAxis tick={CHART_TICK} unit="%" domain={[0, 100]} />
            <Tooltip contentStyle={CHART_TOOLTIP}
              formatter={(val) => [`${val}%`, 'Divergence']} />
            <Bar dataKey="maxmin" name="Maxmin" fill="#1e293b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="minmax" name="Minmax" fill="#94a3b8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-2">% of decisions that changed when CoT prompting was added</p>
      </section>

      <section className="space-y-4">
        {results.map(({ config, concepts }) => (
          <div key={config.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }} aria-hidden="true" />
              <h3 className="text-sm font-semibold text-gray-900">{config.name}</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th scope="col" className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">Concept</th>
                    <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">Divergence</th>
                    <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">Std Payoff (A/B)</th>
                    <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">CoT Payoff (A/B)</th>
                    <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">Meta-Game</th>
                    <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">World State</th>
                  </tr>
                </thead>
                <tbody>
                  {concepts.map(c => (
                    <tr key={c.concept} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-4 text-xs text-gray-600">{CONCEPT_LABELS[c.concept]}</td>
                      <td className="text-center py-2.5 px-4">
                        <span className={`font-mono text-xs font-medium ${c.divergenceRate > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                          {c.divergenceRate}%
                        </span>
                        <span className="text-xs text-gray-400 ml-1">({c.different}/{c.total})</span>
                      </td>
                      <td className="text-center py-2.5 px-4 font-mono text-xs text-gray-700">
                        {c.baseStats ? `${c.baseStats.meanPayoffA.toFixed(4)} / ${c.baseStats.meanPayoffB.toFixed(4)}` : '-'}
                      </td>
                      <td className="text-center py-2.5 px-4 font-mono text-xs text-gray-700">
                        {c.cotStats ? `${c.cotStats.meanPayoffA.toFixed(4)} / ${c.cotStats.meanPayoffB.toFixed(4)}` : '-'}
                      </td>
                      <td className="text-center py-2.5 px-4 text-xs">
                        {c.baseMeta && c.cotMeta ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-gray-500 font-mono">
                              {MODE_NAMES[c.baseMeta.mode_a][0]}/{MODE_NAMES[c.baseMeta.mode_b][0]}
                            </span>
                            <span className="text-gray-300">{'\u2192'}</span>
                            <span className={`font-mono ${c.metaChanged ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                              {MODE_NAMES[c.cotMeta.mode_a][0]}/{MODE_NAMES[c.cotMeta.mode_b][0]}
                            </span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="text-center py-2.5 px-4">
                        {c.baseWS && c.cotWS ? (
                          c.wsChanged ? (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              <WorldStateBadge state={c.baseWS} />
                              <span className="text-gray-300 text-xs">{'\u2192'}</span>
                              <WorldStateBadge state={c.cotWS} />
                            </div>
                          ) : (
                            <WorldStateBadge state={c.baseWS} />
                          )
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
