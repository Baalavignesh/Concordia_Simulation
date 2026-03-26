import { useState, useEffect, Component } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { loadAllData } from './utils/dataLoader'
import Overview from './pages/Overview'
import ConfigDetail from './pages/ConfigDetail'
import CompareView from './pages/CompareView'
import CotComparison from './pages/CotComparison'
import CotComplexity from './pages/CotComplexity'
import { BarChart3, GitCompare, Brain, Microscope } from 'lucide-react'

const NAV_BASE = 'flex items-center gap-1.5 px-3 py-2 rounded text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900'
const NAV_ACTIVE = `${NAV_BASE} bg-gray-100 text-gray-900 font-medium`
const NAV_INACTIVE = `${NAV_BASE} text-gray-500 hover:text-gray-900`

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center" role="alert">
          <div className="border border-gray-200 rounded-lg p-6 max-w-md text-center">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-600">{this.state.error.message}</p>
            <button onClick={() => this.setState({ error: null })}
              className="mt-4 px-4 py-2 bg-gray-100 rounded text-sm text-gray-700 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadAllData()
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading">
        <div className="text-gray-500 text-lg">Loading simulation data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="alert">
        <div className="border border-gray-200 rounded-lg p-6 max-w-md text-center">
          <h1 className="text-lg font-bold text-gray-900 mb-2">Failed to load data</h1>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col">
        <nav aria-label="Main navigation" className="border-b border-gray-200 bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <span className="font-semibold text-sm tracking-wide text-gray-900">Cyber Wargame</span>
              <div className="flex gap-1" role="menubar">
                <NavLink to="/" end className={({ isActive }) => isActive ? NAV_ACTIVE : NAV_INACTIVE}>
                  <BarChart3 className="w-4 h-4" aria-hidden="true" /> Overview
                </NavLink>
                <NavLink to="/compare" className={({ isActive }) => isActive ? NAV_ACTIVE : NAV_INACTIVE}>
                  <GitCompare className="w-4 h-4" aria-hidden="true" /> Compare
                </NavLink>
                <NavLink to="/cot" className={({ isActive }) => isActive ? NAV_ACTIVE : NAV_INACTIVE}>
                  <Brain className="w-4 h-4" aria-hidden="true" /> CoT Analysis
                </NavLink>
                <NavLink to="/cot-complexity" className={({ isActive }) => isActive ? NAV_ACTIVE : NAV_INACTIVE}>
                  <Microscope className="w-4 h-4" aria-hidden="true" /> Reasoning Complexity
                </NavLink>
              </div>
            </div>
          </div>
        </nav>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<Overview data={data} />} />
            <Route path="/config/:configId" element={<ConfigDetail data={data} />} />
            <Route path="/compare" element={<CompareView data={data} />} />
            <Route path="/cot" element={<CotComparison data={data} />} />
            <Route path="/cot-complexity" element={<CotComplexity cotAnalysis={data.__cotAnalysis} />} />
          </Routes>
        </main>

        <footer aria-label="Site footer" className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
          Cyber Wargame Simulation &mdash; Built on Google DeepMind's Concordia Framework
        </footer>
      </div>
    </ErrorBoundary>
  )
}

export default App
