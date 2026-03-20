import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { CONFIGS, CONCEPT_LABELS } from '../utils/constants'
import { getRunStats, getWorldStateDistribution } from '../utils/dataLoader'
import WorldStateBadge from '../components/WorldStateBadge'

const CHART_TICK = { fill: '#6b7280', fontSize: 12 }
const CHART_TOOLTIP = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', color: '#111827' }

export default function CompareView({ data }) {
  const comparison = useMemo(() => CONFIGS.map(c => {
    const d = data[c.id]?.base || data[c.id]?.cot
    const maxmin = d ? getRunStats(d, 'maxmin') : null
    const minmax = d ? getRunStats(d, 'minmax') : null
    const maxminWS = d ? getWorldStateDistribution(d, 'maxmin') : null
    const minmaxWS = d ? getWorldStateDistribution(d, 'minmax') : null
    return { config: c, maxmin, minmax, maxminWS, minmaxWS }
  }).filter(r => r.maxmin || r.minmax), [data])

  const chartData = useMemo(() => comparison.map(r => ({
    name: r.config.short,
    'Maxmin A': r.maxmin ? +r.maxmin.meanPayoffA.toFixed(4) : 0,
    'Maxmin B': r.maxmin ? +r.maxmin.meanPayoffB.toFixed(4) : 0,
    'Minmax A': r.minmax ? +r.minmax.meanPayoffA.toFixed(4) : 0,
    'Minmax B': r.minmax ? +r.minmax.meanPayoffB.toFixed(4) : 0,
  })), [comparison])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Cross-Config Comparison</h1>
        <p className="text-gray-500 text-sm mt-1">Maxmin vs Minmax payoffs across all configurations</p>
      </header>

      <section className="border border-gray-200 rounded-lg p-4" aria-label="Payoff comparison">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Mean Payoffs: Maxmin vs Minmax</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={CHART_TICK} />
            <YAxis tick={CHART_TICK} />
            <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [value.toFixed(4)]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#d1d5db" />
            <Bar dataKey="Maxmin A" fill="#1e293b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Maxmin B" fill="#64748b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Minmax A" fill="#94a3b8" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Minmax B" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="border border-gray-200 rounded-lg overflow-hidden" aria-label="World state outcomes">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-900">World State Outcomes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th scope="col" className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">Config</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">Concept</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">Deterrence</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">Conflict</th>
                <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">Other</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map(({ config, maxminWS, minmaxWS }) => {
                const renderRow = (ws, concept, isFirst) => {
                  if (!ws) return null
                  const det = ws.distribution['Mutual Deterrence'] || 0
                  const con = ws.distribution['Mutual Conflict'] || 0
                  const other = ws.total - det - con
                  return (
                    <tr key={`${config.id}-${concept}`} className="border-b border-gray-50 hover:bg-gray-50">
                      {isFirst && (
                        <td rowSpan={2} className="py-2.5 px-4 border-r border-gray-50">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} aria-hidden="true" />
                            <span className="text-gray-900 text-xs font-medium">{config.name}</span>
                          </div>
                        </td>
                      )}
                      <td className="text-center py-2.5 px-4 text-xs text-gray-500">{CONCEPT_LABELS[concept]}</td>
                      <td className="text-center py-2.5 px-4">
                        <span className="font-mono text-xs">{det}/{ws.total}</span>
                      </td>
                      <td className="text-center py-2.5 px-4">
                        <span className="font-mono text-xs">{con}/{ws.total}</span>
                      </td>
                      <td className="text-center py-2.5 px-4">
                        <span className="font-mono text-xs text-gray-400">{other}/{ws.total}</span>
                      </td>
                    </tr>
                  )
                }
                return [
                  renderRow(maxminWS, 'maxmin', true),
                  renderRow(minmaxWS, 'minmax', false),
                ]
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
