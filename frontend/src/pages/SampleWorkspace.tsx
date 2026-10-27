import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, Bell, ChevronRight, FlaskConical, LayoutDashboard, Radio, RotateCcw, ShieldCheck } from 'lucide-react'
import { WorkspaceMode } from '../components/WorkspaceMode'
import { SoundControl } from '../components/SoundControl'
import { useSamplePlayback } from '../hooks/useSamplePlayback'
import { sampleScenarios, type SampleScenarioId } from '../services/sampleScenarios'
import type { Range } from '../types/api'
import { Dashboard } from './Dashboard'
import { Alerts } from './Alerts'

const NodeDrawer = lazy(() => import('../components/NodeDrawer').then(module => ({ default: module.NodeDrawer })))
// Samples have no mutation path. The shared incident UI also disables its controls.
const readOnly = () => {}

export function SampleWorkspace({ onLive }: { onLive: () => void }) {
  const [run, setRun] = useState<{ id: SampleScenarioId; version: number; focusControl?: 'scenario' | 'restart' }>({ id: 'gas', version: 0 })
  return <SampleRun key={run.version} id={run.id} focusControl={run.focusControl} onLive={onLive}
    onScenario={id => setRun(previous => ({ id, version: previous.version + 1, focusControl: 'scenario' }))}
    onRestart={() => setRun(previous => ({ ...previous, version: previous.version + 1, focusControl: 'restart' }))} />
}

function SampleRun({ id, onScenario, onRestart, onLive, focusControl }: {
  focusControl?: 'scenario' | 'restart'
  id: SampleScenarioId
  onScenario: (id: SampleScenarioId) => void
  onRestart: () => void
  onLive: () => void
}) {
  const scenarioControl = useRef<HTMLSelectElement>(null)
  const restartControl = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    if (focusControl === 'scenario') scenarioControl.current?.focus({ preventScroll: true })
    if (focusControl === 'restart') restartControl.current?.focus({ preventScroll: true })
  }, [focusControl])
  const frame = useSamplePlayback(id)
  const data = frame.snapshot
  const [page, setPage] = useState<'dashboard' | 'alerts'>('dashboard')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('1h')
  const [focus, setFocus] = useState<{ stage: string; id: string } | null>(null)
  const focusedId = focus?.stage === frame.stage.title ? focus.id : frame.stage.focusId
  const selected = data.nodes.find(node => node.id === selectedId)
  const scenario = sampleScenarios.find(item => item.id === id)!
  const navigate = (next: 'dashboard' | 'alerts') => { setPage(next); setSelectedId(null); window.scrollTo(0, 0) }
  return <div className="app-shell sample-workspace">
    <aside className="sidebar" aria-label="Sample navigation">
      <button className="brand sample-brand" onClick={() => navigate('dashboard')}>
        <span className="brand-mark"><Radio size={25} /></span>
        <span>Manhole <b>Pulse</b><small>INFRASTRUCTURE INTELLIGENCE</small></span>
      </button>
      <div className="workspace-label"><span className="workspace-icon"><FlaskConical size={16} /></span>
        <span>VIT Vellore<small>Simulated demonstration</small></span>
      </div>
      <span className="nav-heading">SAMPLE WORKSPACE</span>
      <nav>
        <button className={`nav-item ${page === 'dashboard' ? 'selected' : ''}`} aria-current={page === 'dashboard' ? 'page' : undefined} onClick={() => navigate('dashboard')}><LayoutDashboard size={19} /><span>Dashboard</span></button>
        <button className={`nav-item ${page === 'alerts' ? 'selected' : ''}`} aria-current={page === 'alerts' ? 'page' : undefined} onClick={() => navigate('alerts')}><Bell size={19} /><span>Alerts</span>{!!data.alerts.length && <span className="nav-count">{data.alerts.length}</span>}</button>
      </nav>
      <div className="sidebar-bottom"><div className="system-status"><FlaskConical size={15} /><span>Built-in sample playback</span></div>
        <button className="text-button sample-return" onClick={onLive}><ArrowLeft size={16} /> Return to live monitoring</button>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumb"><span>DEMONSTRATION / VIT VELLORE</span><ChevronRight size={13} /><strong>{page === 'dashboard' ? 'Overview' : 'Alerts'}</strong></div>
        <div className="topbar-right"><SoundControl data={data} disconnected={false} /><span className="source-tag"><FlaskConical size={13} />SAMPLE DATA</span></div>
      </header>
      <main id="main-content">
        <WorkspaceMode sample onChange={onLive} />
        <div id="workspace-panel" role="tabpanel" aria-labelledby="sample-mode-tab">
          <div className="page-heading"><div><div className="heading-eyebrow"><FlaskConical size={13} /> SIMULATED DEMONSTRATION</div>
            <h1>Sample scenarios</h1><p>A prepared network demonstration. No ESP32 or API connection needed.</p></div></div>
          <section className="sample-console" aria-label="Sample scenario playback">
            <div className="sample-console-controls">
              <label>Choose a demonstration<select ref={scenarioControl} aria-label="Sample scenario" value={id} onChange={event => onScenario(event.target.value as SampleScenarioId)}>
                {sampleScenarios.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>
              <p>{scenario.description}</p>
              <button ref={restartControl} className="button secondary" aria-label="Restart scenario" onClick={onRestart}><RotateCcw size={16} />Restart</button>
            </div>
            <div className="sample-stage">
              <div><span className="eyebrow" data-testid="sample-playback-status">{frame.completed ? 'Completed' : 'Automatic playback'} · {frame.elapsed}s / {frame.duration}s</span>
                <h2 aria-live="polite" aria-atomic="true">{frame.stage.title}</h2><p>{frame.stage.caption}</p></div>
              <span className={`sample-run-indicator ${frame.completed ? 'complete' : ''}`}><span />{frame.completed ? 'Final state held' : 'Scenario running'}</span>
            </div>
            <div className="sample-progress" data-testid="sample-progress" role="progressbar" aria-label="Scenario progress"
              aria-valuemin={0} aria-valuemax={frame.duration} aria-valuenow={frame.elapsed}>
              <span style={{ width: `${frame.elapsed / frame.duration * 100}%` }} />
            </div>
            <div className="sample-disclosure"><ShieldCheck size={15} /><span>Built-in sample readings · fictional locations · real sensor data and saved history stay untouched. Incident actions are read-only.</span></div>
          </section>
          <div className="sample-mobile-nav"><button className="button secondary small" onClick={() => navigate(page === 'dashboard' ? 'alerts' : 'dashboard')}>{page === 'dashboard' ? 'View sample alerts' : 'Back to sample dashboard'}</button></div>
          {page === 'dashboard'
            ? <div className="sample-dashboard"><Dashboard data={data} focusedId={focusedId} onFocus={id => setFocus({ stage: frame.stage.title, id })}
                disabled={false} busy={false} onSelect={setSelectedId} onAlerts={() => navigate('alerts')} onAction={readOnly} /></div>
            : <Alerts data={data} focusId={null} onClearFocus={readOnly} busy={false} disabled={false} onSelect={setSelectedId} onAction={readOnly} />}
        </div>
        <footer className="app-footer"><span><ShieldCheck size={13} />Smart Manhole Monitoring System</span><span>Simulated demonstration · sample timeline, not device receipt time</span></footer>
      </main>
    </div>
    {selected && <Suspense fallback={<div className="toast" role="status">Loading sample details...</div>}>
      <NodeDrawer key={selected.id} selectedId={selected.id} detail={{ node: selected, readings: frame.history[selected.id] }} data={data}
        range={range} error="" connectionError={false} notice={null} busy={false} onRange={setRange}
        onSelect={setSelectedId} onClose={() => setSelectedId(null)} onAction={readOnly} />
    </Suspense>}
  </div>
}
