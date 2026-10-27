import { ArrowUpRight, Flame, Wind, Waves, ShieldCheck } from 'lucide-react'
import type { MonitorNode, Summary } from '../types/api'
import { dateTime, gas, readingValue } from '../utils'
import { StatusBadge } from './StatusBadge'
import { conditionView } from '../services/conditionView'
import { ManholeVisualizer } from './ManholeVisualizer'
import { ThresholdGauge } from './ThresholdGauge'

export function SensorOverview({
  node, nodes, thresholds, snapshotCurrent, onFocus, onInspect, sample = false,
}: {
  sample?: boolean
  node: MonitorNode
  nodes: MonitorNode[]
  thresholds: Summary['demo_thresholds']
  snapshotCurrent: boolean
  onFocus: (id: string) => void
  onInspect: (id: string) => void
}) {
  const view = conditionView(node, thresholds, snapshotCurrent)
  const historical = view.mode === 'snapshot-stale' || view.mode === 'offline'
  const channels = [
    { kind: 'methane', label: 'Methane', formula: 'CH₄', icon: Flame, ...gas(node, 'methane') },
    { kind: 'h2s', label: 'Hydrogen sulfide', formula: 'H₂S', icon: Wind, ...gas(node, 'h2s') },
    { kind: 'overflow', label: 'Water height', formula: 'H₂O', icon: Waves, sensor: node.sensors.water_level_cm, unit: 'cm' },
    { kind: 'cover', label: 'Cover integrity', formula: 'LID', icon: ShieldCheck, sensor: node.sensors.cover_displaced, unit: '' },
  ] as const
  return (
    <section className="selected-overview" aria-label="Selected node sensors">
      <div className="selected-heading">
        <div className="selected-title">
          <span className="section-number">01</span>
          <div><span className="eyebrow">BENEATH THE SURFACE</span><h2>Asset condition</h2></div>
        </div>
        <select aria-label="Selected overview node" value={node.id} onChange={(event) => onFocus(event.target.value)}>
          {nodes.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}
        </select>
      </div>
      <div className="asset-stage">
        <ManholeVisualizer view={view} nodeId={node.id} threshold={thresholds.overflow} />
        <div className="asset-readings">
          <div className="asset-identity">
            <span className="eyebrow">{node.id} <span className="identity-divider">/</span> {sample ? 'SAMPLE READINGS' : node.is_demo ? 'SIMULATED TELEMETRY' : 'HARDWARE TELEMETRY'}</span>
            <h3>{node.name}</h3>
            <div className="node-state">
              <span className={`connectivity ${historical ? 'offline' : node.connectivity}`}>
                <span className="status-dot" />{!snapshotCurrent ? 'API unavailable' : node.connectivity}
              </span>
              <StatusBadge status={historical ? 'unknown' : node.safety_status}
                label={historical || node.safety_status === 'unknown' ? 'Safety unconfirmed' : undefined} />
            </div>
          </div>
          <div className="overview-sensors">
            {channels.map((item) => {
              const condition = view.channels[item.kind]
              return (
                <div className={`overview-sensor channel-${condition}`} key={item.kind}>
                  <span><item.icon size={15} />{item.label}<em>{item.formula}</em></span>
                  <strong>{readingValue(item.sensor, item.unit)}</strong>
                  <small>{condition === 'unknown' ? 'No measurement'
                    : condition === 'stale' ? 'Last known · not current'
                      : condition === 'raw' ? 'Uncalibrated · safety unknown'
                        : condition === 'hazard' ? (sample ? 'Sample hazard' : 'Measured hazard')
                          : sample ? 'Sample reading' : 'Current measurement'}</small>
                  {item.kind !== 'cover' && <ThresholdGauge kind={item.kind} value={item.sensor.value} threshold={thresholds[item.kind]} unit={item.unit} condition={condition} />}
                </div>
              )
            })}
          </div>
          <div className="asset-inspect">
            <span>Four channels. One clearer picture.</span>
            <button className="text-button" onClick={() => onInspect(node.id)}>Inspect history <ArrowUpRight size={16} /></button>
          </div>
        </div>
      </div>
      <div className="overview-receipt">
        <span>{sample ? 'Sample timeline' : 'Last telemetry'} <strong>{dateTime(node.last_seen_at)}</strong></span>
        <span>Schematic · water relative to overflow threshold · not to scale</span>
      </div>
    </section>
  )
}
