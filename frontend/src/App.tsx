import { lazy, Suspense, useEffect, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Radio,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { AlertStatus, Range, Scenario } from './types/api'
import { api, refreshDemo } from './services/api'
import { useMonitor } from './hooks/useMonitor'
import { Dashboard } from './pages/Dashboard'
import { Alerts } from './pages/Alerts'
import { Simulator } from './pages/Simulator'
import { dateTime, time } from './utils'

type Page = 'dashboard' | 'alerts' | 'simulator'
const NodeDrawer = lazy(() =>
  import('./components/NodeDrawer').then((module) => ({ default: module.NodeDrawer })),
)
const titles = {
  dashboard: 'Network overview',
  alerts: 'Incident management',
  simulator: 'Demo simulator',
}
function currentPage(): Page {
  const value = location.hash.slice(1)
  return value === 'alerts' || value === 'simulator' ? value : 'dashboard'
}

export default function App() {
  const [page, setPage] = useState<Page>(currentPage)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState('MH-001')
  const [alertFocus, setAlertFocus] = useState<number | null>(null)
  const [scenarioResult, setScenarioResult] = useState<{
    nodeId: string
    scenario: Scenario
    alertId: number | null
    readingId: number
  } | null>(null)
  const [range, setRange] = useState<Range>('24h')
  const [mobileNav, setMobileNav] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null)
  const { data, detail, error, detailError, loading, refresh } = useMonitor(selectedId, range)
  useEffect(() => {
    const sync = () => setPage(currentPage())
    addEventListener('hashchange', sync)
    return () => removeEventListener('hashchange', sync)
  }, [])
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 9000)
      return () => clearTimeout(timer)
    }
  }, [notice])
  function navigate(value: Page, incidentId: number | null = null) {
    setAlertFocus(incidentId)
    location.hash = value
    setPage(value)
    setMobileNav(false)
    setSelectedId(null)
    window.scrollTo(0, 0)
  }
  async function action(
    work: () => Promise<unknown>,
    success: string | ((result: unknown) => string),
  ) {
    if (busy) return false
    setBusy(true)
    setNotice(null)
    try {
      const result = await work()
      setNotice({ error: false, text: typeof success === 'function' ? success(result) : success })
      return true
    } catch (failure) {
      setNotice({
        error: true,
        text: failure instanceof Error ? failure.message : 'Operation failed.',
      })
      return false
    } finally {
      setBusy(false)
      refresh()
    }
  }
  const onScenario = async (id: string, scenario: Scenario) => {
    return action(async () => {
      const result = await api.scenario(id, scenario)
      const incident =
        result.created_alert_ids[0] ??
        (scenario === 'normal' && scenarioResult?.nodeId === id ? scenarioResult.alertId : null) ??
        data?.alerts.find(
          (alert) =>
            alert.node_id === id &&
            alert.status !== 'resolved' &&
            (scenario === 'normal' || alert.alert_type === scenario),
        )?.id ??
        null
      setScenarioResult({ nodeId: id, scenario, alertId: incident, readingId: result.reading_id })
      setFocusedId(id)
      return result
    }, `Simulated ${scenario} reading persisted for ${id}.`)
  }
  const onAction = (id: number, status: Exclude<AlertStatus, 'active'>) => {
    void action(() => api.updateAlert(id, status), `Incident #${id} ${status}.`)
  }
  const onRefreshDemo = () => {
    if (data)
      void action(
        () => refreshDemo(),
        (result) =>
          `${result} demo nodes refreshed to baseline scenarios. History and incidents preserved.`,
      )
  }
  const select = (id: string) => {
    setFocusedId(id)
    setNotice(null)
    setSelectedId(id)
    setRange('24h')
  }
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'simulator', label: 'Simulator', icon: FlaskConical },
  ] as const
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`} aria-label="Main navigation">
        <a className="brand" href="#dashboard" onClick={() => navigate('dashboard')}>
          <span className="brand-mark">
            <Radio size={25} />
          </span>
          <span>
            Smart Manhole<small>MONITORING SYSTEM</small>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">
            <ShieldCheck size={16} />
          </span>
          <span>
            Municipal operations<small>Educational IoT project</small>
          </span>
          <ChevronRight size={14} />
        </div>
        <span className="nav-heading">WORKSPACE</span>
        <nav>
          {nav.map((item) => (
            <a
              href={`#${item.id}`}
              key={item.id}
              className={`nav-item ${page === item.id ? 'selected' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault()
                navigate(item.id)
              }}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === 'alerts' && !!data?.summary.active_incidents && (
                <span className="nav-count">{data.summary.active_incidents}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-status">
            <span className={`status-dot ${error ? 'disconnected' : data ? 'connected' : ''}`} />
            <span>
              {error ? 'API disconnected' : data ? 'Monitoring API connected' : 'Connecting to API'}
            </span>
          </div>
          <div className="project-label">
            <span className="project-avatar">SM</span>
            <span>
              Embedded Systems & IoT<small>Local monitoring workspace</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              title="Open navigation"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>Control room</span>
            <ChevronRight size={13} />
            <strong>
              {page === 'dashboard' ? 'Overview' : page === 'alerts' ? 'Alerts' : 'Simulator'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="source-tag">
              <FlaskConical size={13} />
              {data
                ? data.summary.demo_nodes === data.summary.total_nodes
                  ? 'DEMO DATA'
                  : data.summary.demo_nodes
                    ? 'MIXED SOURCES'
                    : 'HARDWARE DATA'
                : 'LOCAL WORKSPACE'}
            </span>
            <button
              className="icon-button"
              title="Open alerts"
              aria-label="Open alerts"
              onClick={() => navigate('alerts')}
            >
              <Bell size={18} />
              {!!data?.summary.active_incidents && <i className="notification-dot" />}
            </button>
            <span className="operator-avatar">OP</span>
          </div>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <div className="heading-eyebrow">
                <span
                  className={`status-dot ${error ? 'disconnected' : data ? 'connected' : ''}`}
                />
                {error
                  ? 'CONNECTION INTERRUPTED'
                  : data
                    ? 'MONITORING API CONNECTED'
                    : 'CONNECTING'}
              </div>
              <h1>{titles[page]}</h1>
              <p>
                {page === 'dashboard'
                  ? 'Gas, overflow and cover integrity across your monitored network.'
                  : page === 'alerts'
                    ? 'Track measured events and their operator review status.'
                    : 'Synthetic events, real persistence. Hardware records stay separate.'}
              </p>
            </div>
            <div className="page-actions">
              <span
                className="last-updated"
                title={data ? dateTime(data.summary.generated_at) : undefined}
              >
                {data ? `API checked ${time(data.summary.generated_at)}` : 'Awaiting data'}
              </span>
              <button
                className="icon-button"
                aria-label="Refresh API data"
                title="Refresh API data"
                disabled={loading}
                onClick={refresh}
              >
                <RefreshCw size={17} className={loading ? 'spin' : ''} />
              </button>
              {page === 'dashboard' && (
                <button
                  className="button secondary"
                  onClick={onRefreshDemo}
                  disabled={
                    busy || !!error || !data?.summary.demo_enabled || !data?.summary.demo_nodes
                  }
                >
                  <FlaskConical size={15} />
                  {busy ? 'Restoring...' : 'Restore baseline'}
                </button>
              )}
            </div>
          </div>
          {data?.summary.demo_session?.enabled && (
            <div className={`demo-session-strip ${data.summary.demo_session.emitter_status}`}>
              <FlaskConical size={18} />
              <strong>
                {data.summary.demo_session.emitter_status === 'running'
                  ? 'LIVE SIMULATION'
                  : 'SIMULATION PAUSED'}{' '}
                · VIT Vellore
              </strong>
              <span>
                {data.summary.demo_session.emitter_status === 'running'
                  ? `Synthetic readings every ${data.summary.demo_session.interval_seconds}s`
                  : 'Emitter stopped · observations will become stale'}
              </span>
              <span>Last emission: {dateTime(data.summary.demo_session.last_tick_at)}</span>
            </div>
          )}
          {error && (
            <div className="connection-banner" role="alert">
              <CircleAlert size={20} />
              <div>
                <strong>Monitoring API unavailable</strong>
                <p>
                  {error}{' '}
                  {data
                    ? 'Showing the last successful snapshot; values are not current.'
                    : 'Start the Flask backend to load monitoring data.'}
                </p>
              </div>
              <button className="button secondary small" onClick={refresh}>
                Retry
              </button>
            </div>
          )}
          {!data && !error && (
            <div className="initial-loading" role="status">
              <Activity className="spin" size={28} />
              <h2>Connecting to the monitoring network</h2>
              <p>Loading nodes, telemetry and incidents.</p>
            </div>
          )}
          {!data && error && (
            <div className="empty-state connection-empty">
              <Radio size={35} />
              <h2>No monitoring data available</h2>
              <p>Database-backed readings will appear when the API reconnects.</p>
            </div>
          )}
          {data && (
            <div className="page-content" key={page}>
              {page === 'dashboard' ? (
                <Dashboard
                  data={data}
                  focusedId={focusedId}
                  onFocus={setFocusedId}
                  disabled={!!error}
                  busy={busy}
                  onSelect={select}
                  onAlerts={() => navigate('alerts')}
                  onAction={onAction}
                />
              ) : page === 'alerts' ? (
                <Alerts
                  data={data}
                  focusId={alertFocus}
                  onClearFocus={() => setAlertFocus(null)}
                  busy={busy}
                  disabled={!!error}
                  onSelect={select}
                  onAction={onAction}
                />
              ) : (
                <Simulator
                  data={data}
                  focusedId={focusedId}
                  onFocus={setFocusedId}
                  result={scenarioResult}
                  onIncident={(id) => navigate('alerts', id)}
                  busy={busy}
                  disabled={!!error}
                  onSelect={select}
                  onScenario={onScenario}
                  onRefreshDemo={onRefreshDemo}
                />
              )}
            </div>
          )}
          <footer className="app-footer">
            <span>
              <ShieldCheck size={13} />
              Smart Manhole Monitoring System
            </span>
            <span>
              Educational demonstrator <i />
              {data ? `${data.summary.demo_nodes} simulated nodes` : 'Flask + SQLite'}
              <ArrowUpRight size={12} />
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div
          className={`toast ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? <CircleAlert size={19} /> : <CheckCircle2 size={19} />}
          <span>{notice.text}</span>
          <button
            className="icon-button"
            title="Dismiss notification"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {selectedId && data && (
        <Suspense
          fallback={
            <div className="toast" role="status">
              Loading node details...
            </div>
          }
        >
          <NodeDrawer
            key={selectedId}
            selectedId={selectedId}
            detail={detail}
            data={data}
            range={range}
            error={detailError}
            connectionError={!!error}
            notice={notice}
            busy={busy}
            onRange={setRange}
            onClose={() => setSelectedId(null)}
            onAction={onAction}
          />
        </Suspense>
      )}
    </div>
  )
}
