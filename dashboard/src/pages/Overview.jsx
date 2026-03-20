import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CONFIGS, CONCEPT_LABELS } from '../utils/constants'
import { getRunStats, getWorldStateDistribution, getMetaModeDistribution } from '../utils/dataLoader'
import WorldStateBadge from '../components/WorldStateBadge'
import { ArrowRight } from 'lucide-react'

export default function Overview({ data }) {
  const rows = useMemo(() => CONFIGS.map(config => {
    const configData = data[config.id]
    const base = configData?.base
    const cot = configData?.cot

    const build = (source, label) => {
      if (!source) return null
      const maxmin = getRunStats(source, 'maxmin')
      const minmax = getRunStats(source, 'minmax')
      const maxminWS = getWorldStateDistribution(source, 'maxmin')
      const minmaxWS = getWorldStateDistribution(source, 'minmax')
      const maxminMeta = getMetaModeDistribution(source, 'maxmin')
      const minmaxMeta = getMetaModeDistribution(source, 'minmax')
      return { label, maxmin, minmax, maxminWS, minmaxWS, maxminMeta, minmaxMeta }
    }

    return {
      config,
      standard: build(base, 'Standard'),
      cot: build(cot, 'CoT'),
    }
  }).filter(r => r.standard || r.cot), [data])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Simulation Results</h1>
        <p className="text-gray-500 text-sm mt-1">
          LLM agent decisions across 5 cognitive profiles, 2 solution concepts
        </p>
      </header>

      <div className="space-y-6">
        {rows.map(({ config, standard, cot }) => (
          <section key={config.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }} aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-sm text-gray-900">{config.name}</h2>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
              </div>
              <Link to={`/config/${config.id}`}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                Details <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th scope="col" className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium w-24">Mode</th>
                    <th scope="col" className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium w-28">Concept</th>
                    <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">A Payoff</th>
                    <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">B Payoff</th>
                    <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">Runs</th>
                    <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium">Dominant Outcome</th>
                    <th scope="col" className="text-center py-2.5 px-4 text-xs text-gray-400 font-medium hidden lg:table-cell">Top Meta Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {[standard, cot].filter(Boolean).map(source => (
                    ['maxmin', 'minmax'].map(concept => {
                      const stats = source[concept]
                      const wsDist = concept === 'maxmin' ? source.maxminWS : source.minmaxWS
                      const metaDist = concept === 'maxmin' ? source.maxminMeta : source.minmaxMeta
                      if (!stats) return null

                      const dominantWS = wsDist ? Object.entries(wsDist.distribution).sort((a, b) => b[1] - a[1])[0] : null
                      const topModeA = metaDist ? Object.entries(metaDist.a).sort((a, b) => b[1] - a[1])[0] : null
                      const topModeB = metaDist ? Object.entries(metaDist.b).sort((a, b) => b[1] - a[1])[0] : null

                      const isFirstOfGroup = concept === 'maxmin'

                      return (
                        <tr key={`${source.label}-${concept}`}
                          className={`hover:bg-gray-50 ${isFirstOfGroup && source === cot ? 'border-t border-gray-100' : ''} ${!isFirstOfGroup ? '' : ''}`}>
                          {isFirstOfGroup && (
                            <td rowSpan={2} className="py-2.5 px-4 border-r border-gray-50">
                              <span className={`text-xs font-medium px-2 py-1 rounded ${source.label === 'CoT' ? 'bg-gray-100 text-gray-700' : 'text-gray-500'}`}>
                                {source.label}
                              </span>
                            </td>
                          )}
                          <td className="py-2.5 px-4">
                            <span className="text-xs text-gray-600">{CONCEPT_LABELS[concept]}</span>
                          </td>
                          <td className="text-center py-2.5 px-4 font-mono text-gray-900 font-medium">
                            {stats.meanPayoffA.toFixed(4)}
                          </td>
                          <td className="text-center py-2.5 px-4 font-mono text-gray-900 font-medium">
                            {stats.meanPayoffB.toFixed(4)}
                          </td>
                          <td className="text-center py-2.5 px-4 text-gray-500">
                            {stats.numRuns}
                          </td>
                          <td className="text-center py-2.5 px-4">
                            {dominantWS && (
                              <div className="flex items-center justify-center gap-1.5">
                                <WorldStateBadge state={dominantWS[0]} />
                                <span className="text-xs text-gray-400">{dominantWS[1]}/{wsDist.total}</span>
                              </div>
                            )}
                          </td>
                          <td className="text-center py-2.5 px-4 hidden lg:table-cell">
                            {topModeA && topModeB && (
                              <span className="text-xs font-mono text-gray-600">
                                A:{topModeA[0]} B:{topModeB[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <section className="border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th scope="col" className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Config</th>
                <th scope="col" colSpan={2} className="text-center py-2 px-3 text-xs text-gray-400 font-medium border-l border-gray-100">
                  Maxmin (A / B)
                </th>
                <th scope="col" colSpan={2} className="text-center py-2 px-3 text-xs text-gray-400 font-medium border-l border-gray-100">
                  Minmax (A / B)
                </th>
                <th scope="col" className="text-center py-2 px-3 text-xs text-gray-400 font-medium border-l border-gray-100">
                  Price of Aggression
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ config, standard, cot }) => {
                const source = standard || cot
                if (!source?.maxmin || !source?.minmax) return null
                const lambdaA = source.minmax.meanPayoffA !== 0
                  ? (source.maxmin.meanPayoffA / source.minmax.meanPayoffA).toFixed(3)
                  : '-'
                const lambdaB = source.minmax.meanPayoffB !== 0
                  ? (source.maxmin.meanPayoffB / source.minmax.meanPayoffB).toFixed(3)
                  : '-'

                return (
                  <tr key={config.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} aria-hidden="true" />
                        <span className="text-gray-900 text-xs font-medium">{config.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-3 font-mono text-xs text-gray-800 border-l border-gray-50">
                      {source.maxmin.meanPayoffA.toFixed(4)}
                    </td>
                    <td className="text-center py-2.5 px-3 font-mono text-xs text-gray-800">
                      {source.maxmin.meanPayoffB.toFixed(4)}
                    </td>
                    <td className="text-center py-2.5 px-3 font-mono text-xs text-gray-800 border-l border-gray-50">
                      {source.minmax.meanPayoffA.toFixed(4)}
                    </td>
                    <td className="text-center py-2.5 px-3 font-mono text-xs text-gray-800">
                      {source.minmax.meanPayoffB.toFixed(4)}
                    </td>
                    <td className="text-center py-2.5 px-3 font-mono text-xs text-gray-500 border-l border-gray-50">
                      A:{lambdaA} / B:{lambdaB}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
