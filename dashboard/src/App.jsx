import { useState, useEffect, Component } from 'react'
import { Routes, Route, NavLink, Navigate, useParams } from 'react-router-dom'
import { loadAllData } from './utils/dataLoader'
import Overview from './pages/Overview'
import Matchups from './pages/Matchups'
import Reasoning from './pages/Reasoning'
import { BarChart3, Swords, Sparkles } from 'lucide-react'

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

function ConfigRedirect() {
  const { configId } = useParams()
  return <Navigate to={`/matchups?a=${configId}&b=${configId}`} replace />
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
        <nav aria-label="Main navigation" className="border-b border-gray-200 bg-white sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <span className="font-semibold text-sm tracking-wide text-gray-900">Cyber Wargame</span>
              <div className="flex gap-1" role="menubar">
                <NavLink to="/" end className={({ isActive }) => isActive ? NAV_ACTIVE : NAV_INACTIVE}>
                  <BarChart3 className="w-4 h-4" aria-hidden="true" /> Overview
                </NavLink>
                <NavLink to="/matchups" className={({ isActive }) => isActive ? NAV_ACTIVE : NAV_INACTIVE}>
                  <Swords className="w-4 h-4" aria-hidden="true" /> Matchups
                </NavLink>
                <NavLink to="/reasoning" className={({ isActive }) => isActive ? NAV_ACTIVE : NAV_INACTIVE}>
                  <Sparkles className="w-4 h-4" aria-hidden="true" /> Reasoning
                </NavLink>
              </div>
            </div>
          </div>
        </nav>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<Overview data={data} />} />
            <Route path="/matchups" element={<Matchups data={data} />} />
            <Route path="/reasoning" element={<Reasoning data={data} />} />
            {/* Back-compat redirects */}
            <Route path="/config/:configId" element={<ConfigRedirect />} />
            <Route path="/compare" element={<Navigate to="/matchups" replace />} />
            <Route path="/cross-play" element={<Navigate to="/matchups" replace />} />
            <Route path="/cot" element={<Navigate to="/reasoning" replace />} />
            <Route path="/cot-complexity" element={<Navigate to="/reasoning" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
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
