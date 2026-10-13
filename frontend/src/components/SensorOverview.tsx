import { ArrowUpRight, Flame, Wind, Waves, ShieldCheck } from 'lucide-react'
import type { MonitorNode } from '../types/api'
import { dateTime, gas, readingValue } from '../utils'
import { StatusBadge } from './StatusBadge'

export function SensorOverview({
  node,
  nodes,
  onFocus,
  onInspect,
}: {
  node: MonitorNode
  nodes: MonitorNode[]
  onFocus: (id: string) => void
  onInspect: (id: string) => void
}) {
  return (
    <section className="selected-overview" aria-label="Selected node sensors">
      <div className="selected-heading">
        <div>
          <span className="eyebrow">
            SELECTED ASSET · {node.is_demo ? 'SIMULATED' : 'HARDWARE'}
          </span>
          <select
            aria-label="Selected overview node"
            value={node.id}
            onChange={(event) => onFocus(event.target.value)}
          >
            {nodes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} · {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="node-state">
          <span className={`connectivity ${node.connectivity}`}>{node.connectivity}</span>
          <StatusBadge
            status={node.safety_status}
            label={node.safety_status === 'unknown' ? 'Safety unknown' : undefined}
          />
          <button className="text-button" onClick={() => onInspect(node.id)}>
            Inspect history <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
      <div className="overview-sensors" key={`${node.id}-${node.latest_reading?.id}`}>
        {[
          { label: 'Methane', icon: Flame, ...gas(node, 'methane') },
          { label: 'Hydrogen sulfide', icon: Wind, ...gas(node, 'h2s') },
          { label: 'Water height', icon: Waves, sensor: node.sensors.water_level_cm, unit: 'cm' },
          {
            label: 'Cover integrity',
            icon: ShieldCheck,
            sensor: node.sensors.cover_displaced,
            unit: '',
          },
        ].map((item) => (
          <div className="overview-sensor" key={item.label}>
            <span>
              <item.icon size={17} />
              {item.label}
            </span>
            <strong>{readingValue(item.sensor, item.unit)}</strong>
            <small>
              {item.sensor.value === null
                ? 'Unknown'
                : !item.sensor.fresh
                  ? 'Stale measurement'
                  : item.unit === 'raw'
                    ? 'Current · uncalibrated'
                    : 'Current measurement'}
            </small>
          </div>
        ))}
      </div>
      <div className="overview-receipt">
        <span>Last received: {dateTime(node.last_seen_at)}</span>
        <span>
          {node.reading_freshness === 'stale'
            ? `Stale · last measured ${node.last_measured_safety}`
            : node.safety_status === 'unknown'
              ? 'Current partial measurements · safety unknown'
              : 'Fresh sensor observations'}
        </span>
      </div>
    </section>
  )
}
