import { useState, useMemo } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { CONFIGS, CONCEPT_LABELS, SUBGAME_KEYS } from '../utils/constants'

const CHART_TICK = { fill: '#6b7280', fontSize: 12 }
const CHART_TOOLTIP = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', color: '#111827' }

const BTN_ACTIVE = 'px-3 py-1.5 text-xs font-medium rounded bg-gray-900 text-white'
const BTN_INACTIVE = 'px-3 py-1.5 text-xs font-medium rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100'

const METRIC_LABELS = {
  avg_reasoning_length: 'Avg Reasoning Length',
  avg_opponent_modeling: 'Opponent Modeling',
  dominance_recognition_rate: 'Dominance Recognition',
  avg_hedge_count: 'Hedging / Uncertainty',
  avg_comparison_count: 'Deliberation',
}

const METRIC_DESCRIPTIONS = {
  avg_reasoning_length: 'Average word count per reasoning trace — longer traces suggest harder decisions',
  avg_opponent_modeling: 'How often the agent references the opponent — higher means deeper theory-of-mind',
  dominance_recognition_rate: 'Fraction of subgames where the agent identifies a dominant strategy',
  avg_hedge_count: 'Uncertainty language (however, might, depends) — higher means more deliberation under uncertainty',
  avg_comparison_count: 'Explicit weighing of alternatives (better than, vs, prefer) — higher means more deliberation',
}

export default function CotComplexity({ cotAnalysis }) {
  const [concept, setConcept] = useState('maxmin')

  const comparison = useMemo(() => {
    if (!cotAnalysis?.cross_config_comparison) return null
    return cotAnalysis.cross_config_comparison
  }, [cotAnalysis])

  const configDetails = useMemo(() => {
    if (!cotAnalysis?.configs) return []
    return cotAnalysis.configs.map(c => {
      const cfg = CONFIGS.find(x => x.id === c.config)
      return { ...c, cfg }
    }).filter(c => c.cfg)
  }, [cotAnalysis])

  const barChartData = useMemo(() => {
    if (!comparison) return []
    return CONFIGS.map(c => {
      const d = comparison[c.id]?.[concept]
      if (!d) return null
      return {
        name: c.short,
        color: c.color,
        words: d.avg_reasoning_length,
        dominance: +(d.dominance_recognition_rate * 100).toFixed(0),
        opponent: d.avg_opponent_modeling,
        hedging: d.avg_hedge_count,
        deliberation: d.avg_comparison_count,
      }
    }).filter(Boolean)
  }, [comparison, concept])

  const complexityRanking = useMemo(() => {
    if (!configDetails.length) return []
    return configDetails.map(({ cfg, concepts }) => {
      const d = concepts[concept]
      if (!d) return null
      return {
        config: cfg,
        ranking: d.complexity_ranking,
        hardest: d.complexity_ranking[0],
        easiest: d.complexity_ranking[d.complexity_ranking.length - 1],
      }
    }).filter(Boolean)
  }, [configDetails, concept])

  if (!cotAnalysis || !comparison) {
    return (
      <div className="text-gray-500 p-8 text-center" role="status">
        No CoT complexity analysis data found. Run <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">python3 analyze_cot.py</code> to generate it.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">CoT Reasoning Complexity</h1>
        <p className="text-gray-500 text-sm mt-1">
          How different personas reason through strategic decisions — parsed from Chain-of-Thought traces
        </p>
      </header>

      {/* Concept toggle */}
      <div className="flex items-center gap-2" role="group" aria-label="Solution concept">
        {['maxmin', 'minmax'].map(c => (
          <button key={c} onClick={() => setConcept(c)}
            className={concept === c ? BTN_ACTIVE : BTN_INACTIVE}
            aria-pressed={concept === c}>
            {CONCEPT_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Explainer */}
      <section className="border border-gray-200 rounded-lg p-4 bg-gray-50" aria-label="What this analysis measures">
        <h2 className="text-sm font-medium text-gray-900 mb-2">What this analysis measures</h2>
        <p className="text-xs text-gray-600 leading-relaxed mb-3">
          When Chain-of-Thought prompting is enabled, each agent produces a reasoning trace before making a decision.
          This page parses those traces to extract complexity metrics — how long the agent reasons, whether it models
          the opponent, whether it recognizes dominant strategies, and how much uncertainty it expresses. These metrics
          serve as proxies for <strong>problem-solving complexity</strong>: harder decisions produce longer, more
          hedged, more deliberative reasoning.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(METRIC_DESCRIPTIONS).map(([key, desc]) => (
            <div key={key} className="text-xs">
              <span className="font-medium text-gray-700">{METRIC_LABELS[key]}</span>
              <span className="text-gray-400"> — {desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Cross-config comparison: reasoning length bar chart */}
      <section className="border border-gray-200 rounded-lg p-4" aria-label="Reasoning length by config">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Average Reasoning Length</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={CHART_TICK} />
            <YAxis tick={CHART_TICK} unit=" words" />
            <Tooltip contentStyle={CHART_TOOLTIP}
              formatter={(val) => [`${val} words`, 'Avg Length']} />
            <Bar dataKey="words" name="Words" radius={[3, 3, 0, 0]}>
              {barChartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-2">Average word count per reasoning trace across all subgames</p>
      </section>

      {/* Dominance recognition bar chart */}
      <section className="border border-gray-200 rounded-lg p-4" aria-label="Dominance recognition rate">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Dominance Recognition Rate</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={CHART_TICK} />
            <YAxis tick={CHART_TICK} unit="%" domain={[0, 100]} />
            <Tooltip contentStyle={CHART_TOOLTIP}
              formatter={(val) => [`${val}%`, 'Recognition Rate']} />
            <Bar dataKey="dominance" name="Dominance %" radius={[3, 3, 0, 0]}>
              {barChartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-2">Fraction of subgames where the agent identifies a strictly dominant strategy</p>
      </section>

      {/* Cross-config comparison table */}
      <section className="border border-gray-200 rounded-lg overflow-hidden" aria-label="Cross-config comparison table">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Detailed Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th scope="col" className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">Config</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium cursor-help" title="Average word count per reasoning trace — longer traces suggest harder decisions">Avg Words</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium cursor-help" title="How often the agent references the opponent — higher means deeper theory-of-mind">Opponent Modeling</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium cursor-help" title="Fraction of subgames where the agent identifies a strictly dominant strategy">Dominance</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium hidden sm:table-cell cursor-help" title="Uncertainty language (however, might, depends) — higher means more deliberation under uncertainty">Hedging</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium hidden sm:table-cell cursor-help" title="Explicit weighing of alternatives (better than, vs, prefer) — higher means more deliberation">Deliberation</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium hidden lg:table-cell cursor-help" title="Subgame with the longest average reasoning trace for this config">Hardest</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium hidden lg:table-cell cursor-help" title="Subgame with the shortest average reasoning trace for this config">Easiest</th>
              </tr>
            </thead>
            <tbody>
              {CONFIGS.map(c => {
                const d = comparison[c.id]?.[concept]
                if (!d) return null
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} aria-hidden="true" />
                        <span className="text-xs font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-4 font-mono text-xs text-gray-700">{d.avg_reasoning_length}</td>
                    <td className="text-center py-2.5 px-4 font-mono text-xs text-gray-700">{d.avg_opponent_modeling}</td>
                    <td className="text-center py-2.5 px-4">
                      <span className={`font-mono text-xs font-medium ${d.dominance_recognition_rate >= 0.5 ? 'text-gray-900' : 'text-gray-400'}`}>
                        {(d.dominance_recognition_rate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-center py-2.5 px-4 font-mono text-xs text-gray-700 hidden sm:table-cell">{d.avg_hedge_count}</td>
                    <td className="text-center py-2.5 px-4 font-mono text-xs text-gray-700 hidden sm:table-cell">{d.avg_comparison_count}</td>
                    <td className="text-center py-2.5 px-4 font-mono text-xs text-gray-700 hidden lg:table-cell">{d.hardest_subgame}</td>
                    <td className="text-center py-2.5 px-4 font-mono text-xs text-gray-700 hidden lg:table-cell">{d.easiest_subgame}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Per-subgame complexity heatmap */}
      <section className="border border-gray-200 rounded-lg overflow-hidden" aria-label="Subgame complexity heatmap">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Subgame Complexity Ranking</h2>
          <p className="text-xs text-gray-400 mt-0.5">Average reasoning length (words) per subgame — darker = more complex</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th scope="col" className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">Config</th>
                {SUBGAME_KEYS.map(k => (
                  <th key={k} scope="col" className="text-center py-2.5 px-2 text-xs text-gray-400 font-medium">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {configDetails.map(({ cfg, concepts }) => {
                const d = concepts[concept]
                if (!d?.subgames) return null
                // Find max word count across all cells for this config to scale opacity
                const allWords = SUBGAME_KEYS.map(k => {
                  const sg = d.subgames[k]
                  return sg ? (sg.A.word_count.mean + sg.B.word_count.mean) / 2 : 0
                })
                const maxWords = Math.max(...allWords, 1)
                return (
                  <tr key={cfg.id} className="border-b border-gray-50">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                        <span className="text-xs font-medium text-gray-900">{cfg.short}</span>
                      </div>
                    </td>
                    {SUBGAME_KEYS.map(k => {
                      const sg = d.subgames[k]
                      if (!sg) return <td key={k} className="text-center py-2.5 px-2 text-xs text-gray-300">-</td>
                      const avg = (sg.A.word_count.mean + sg.B.word_count.mean) / 2
                      const opacity = 0.1 + (avg / maxWords) * 0.6
                      return (
                        <td key={k} className="text-center py-2.5 px-2">
                          <span className="inline-block rounded px-1.5 py-0.5 font-mono text-xs"
                            style={{ backgroundColor: `rgba(17, 24, 39, ${opacity})`, color: opacity > 0.4 ? '#fff' : '#374151' }}>
                            {avg.toFixed(0)}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Key findings */}
      <section className="border border-gray-200 rounded-lg p-4" aria-label="Key findings">
        <h2 className="text-sm font-medium text-gray-900 mb-2">Key Findings</h2>
        <ul className="space-y-1.5 text-xs text-gray-600 list-disc list-inside">
          <li>
            <strong>Rational agents</strong> recognize dominant strategies most often ({comparison.v1_rational_eut?.[concept]?.dominance_recognition_rate !== undefined
              ? `${(comparison.v1_rational_eut[concept].dominance_recognition_rate * 100).toFixed(0)}%`
              : '-'}), while <strong>Retaliatory agents</strong> almost never do ({comparison.v5_irrational_retaliatory?.[concept]?.dominance_recognition_rate !== undefined
              ? `${(comparison.v5_irrational_retaliatory[concept].dominance_recognition_rate * 100).toFixed(0)}%`
              : '-'}).
          </li>
          <li>
            <strong>Retaliatory agents</strong> have the highest opponent modeling ({comparison.v5_irrational_retaliatory?.[concept]?.avg_opponent_modeling ?? '-'} mentions) but still make poor strategic choices — modeling the opponent does not guarantee rational play.
          </li>
          <li>
            <strong>Prospect Theory agents</strong> hedge the most ({comparison.v3_bounded_prospect_theory?.[concept]?.avg_hedge_count ?? '-'} per trace), consistent with loss-aversion framing.
          </li>
          <li>
            Subgame complexity varies by mode combination — subgames involving <strong>Coalition (C)</strong> tend to produce shorter, less deliberate reasoning.
          </li>
        </ul>
      </section>
    </div>
  )
}
