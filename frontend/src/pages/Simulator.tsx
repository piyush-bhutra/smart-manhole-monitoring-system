import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Flame,
  ShieldAlert,
  Waves,
  Wind,
  Play,
  RotateCcw,
  Database,
} from 'lucide-react'
import type { Scenario, Snapshot } from '../types/api'
import { StatusBadge } from '../components/StatusBadge'
import { dateTime } from '../utils'

const scenarios = [
  {
    id: 'normal',
    name: 'Normal readings',
    icon: CheckCircle2,
    channel: 'All channels within demo thresholds',
  },
  {
    id: 'methane',
    name: 'Methane hazard',
    icon: Flame,
    channel: 'Synthetic methane at 150% of threshold',
  },
  { id: 'h2s', name: 'H2S hazard', icon: Wind, channel: 'Synthetic H2S at 150% of threshold' },
  {
    id: 'overflow',
    name: 'Water overflow',
    icon: Waves,
    channel: 'Synthetic water height at 150% of threshold',
  },
  { id: 'cover', name: 'Cover displacement', icon: ShieldAlert, channel: 'Cover displaced: true' },
] as const

export function Simulator({
  data,
  busy,
  disabled,
  onScenario,
  onRefreshDemo,
  onSelect,
  focusedId,
  onFocus,
  result,
  onIncident,
}: {
  data: Snapshot
  busy: boolean
  disabled: boolean
  onScenario: (id: string, scenario: Scenario) => Promise<boolean>
  onRefreshDemo: () => void
  onSelect: (id: string) => void
  focusedId: string
  onFocus: (id: string) => void
  result: { nodeId: string; scenario: Scenario; alertId: number | null; readingId: number } | null
  onIncident: (id: number) => void
}) {
  const demoNodes = data.nodes.filter((node) => node.is_demo && node.demo_scenario !== 'offline')
  const [scenario, setScenario] = useState<Scenario>('methane')
  const resultPanel = useRef<HTMLDivElement>(null)
  const node = demoNodes.find((node) => node.id === focusedId) || demoNodes[0]
  useEffect(() => {
    if (node?.demo_scenario && scenarios.some((item) => item.id === node.demo_scenario))
      setScenario(node.demo_scenario as Scenario)
  }, [node?.id, node?.demo_scenario])
  const unavailable = busy || disabled || !data.summary.demo_enabled || !node
  useEffect(() => {
    if (result?.nodeId === node?.id)
      resultPanel.current?.scrollIntoView({
        block: 'nearest',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
  }, [result?.readingId, result?.nodeId, node?.id])
  return (
    <div className="simulator-page">
      <div className="demo-band">
        <FlaskConical size={22} />
        <div>
          <strong>SIMULATED DATA</strong>
          <span>Educational demonstration · Synthetic sensor values · No hardware control</span>
        </div>
        <span className="demo-mode">
          {data.summary.demo_enabled ? 'Demo enabled' : 'Demo disabled'}
        </span>
      </div>
      <div className="simulator-grid">
        <section className="scenario-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SCENARIO CONTROL</span>
              <h2>Generate a sensor event</h2>
            </div>
          </div>
          <label className="field-label" htmlFor="demo-node">
            Demo manhole
          </label>
          <select
            id="demo-node"
            className="node-select"
            value={node?.id || ''}
            onChange={(event) => onFocus(event.target.value)}
            disabled={!demoNodes.length || busy}
          >
            {demoNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.id} · {node.name}
              </option>
            ))}
          </select>
          <fieldset className="scenario-options">
            <legend>Scenario</legend>
            {scenarios.map((item) => (
              <label
                className={`scenario-option ${item.id} ${scenario === item.id ? 'selected' : ''}`}
                key={item.id}
              >
                <input
                  type="radio"
                  name="scenario"
                  value={item.id}
                  checked={scenario === item.id}
                  onChange={() => setScenario(item.id)}
                  disabled={busy}
                />
                <span className="scenario-icon">
                  <item.icon size={20} />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.channel}</small>
                </span>
                <span className="radio-mark" />
              </label>
            ))}
          </fieldset>
          <div className="scenario-buttons">
            <button
              className="button primary"
              disabled={unavailable}
              onClick={() => node && onScenario(node.id, scenario)}
            >
              <Play size={16} />
              {busy ? 'Sending...' : 'Trigger scenario'}
            </button>
            <button
              className="button secondary"
              disabled={unavailable}
              onClick={async () => {
                if (node && (await onScenario(node.id, 'normal'))) setScenario('normal')
              }}
            >
              <RotateCcw size={16} />
              Restore normal
            </button>
          </div>
          {result && result.nodeId === node?.id && (
            <div className="scenario-result" role="status" ref={resultPanel}>
              <CheckCircle2 size={20} />
              <div>
                <strong>
                  {result.scenario === 'normal' ? 'Normal scenario restored' : 'Scenario persisted'}
                </strong>
                <p>Observation #{result.readingId} · continued by the simulator worker</p>
                <div>
                  <button className="button secondary" onClick={() => onSelect(result.nodeId)}>
                    Inspect affected node <ChevronRight size={15} />
                  </button>
                  {result.alertId !== null && (
                    <button
                      className="button secondary"
                      onClick={() => onIncident(result.alertId!)}
                    >
                      View corresponding incident <ChevronRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
        <aside className="simulation-status">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SELECTED ASSET</span>
              <h2>{node?.id || 'No demo nodes'}</h2>
            </div>
            <FlaskConical size={22} />
          </div>
          {node && (
            <>
              <h3>{node.name}</h3>
              <StatusBadge status={node.computed_status} />
              <dl>
                <div>
                  <dt>Data source</dt>
                  <dd>Simulated</dd>
                </div>
                <div>
                  <dt>Last telemetry</dt>
                  <dd>{dateTime(node.last_seen_at)}</dd>
                </div>
                <div>
                  <dt>Stored observation</dt>
                  <dd>#{node.latest_reading?.id || 'None'}</dd>
                </div>
              </dl>
              <button className="text-button" onClick={() => onSelect(node.id)}>
                Inspect readings <ChevronRight size={16} />
              </button>
            </>
          )}
          <div className="demo-dataset">
            <Database size={20} />
            <h3>Demonstration dataset</h3>
            <p>
              {data.nodes.filter((node) => node.is_demo).length} fictional VIT placements.
              Persistent scenarios. Demo thresholds only.
            </p>
            <button
              className="button secondary"
              disabled={busy || disabled || !data.summary.demo_enabled || !demoNodes.length}
              onClick={onRefreshDemo}
            >
              <RotateCcw size={15} />
              Restore baseline
            </button>
            <small>
              Restores baseline measurements only. Incident history stays intact. MH-007 remains the
              reserved offline example; hardware records are excluded.
            </small>
          </div>
        </aside>
      </div>
    </div>
  )
}
