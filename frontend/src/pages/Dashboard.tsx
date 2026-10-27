import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  CircleCheck,
  CircleHelp,
  Radio,
  Search,
  ShieldAlert,
  Unplug,
  ChevronRight,
} from 'lucide-react'
import type { AlertStatus, NodeStatus, Snapshot } from '../types/api'
import { canResolve, dateTime, gas, readingValue } from '../utils'
import { StatusBadge } from '../components/StatusBadge'
import { NodeMap } from '../components/NodeMap'
import { AlertList } from '../components/AlertList'
import { SensorOverview } from '../components/SensorOverview'

import { IncidentRibbon } from '../components/IncidentRibbon'

export function Dashboard({
  data,
  focusedId,
  onFocus,
  disabled,
  busy,
  onSelect,
  onAlerts,
  onAction,
}: {
  data: Snapshot
  focusedId: string
  onFocus: (id: string) => void
  disabled: boolean
  busy: boolean
  onSelect: (id: string) => void
  onAlerts: () => void
  onAction: (id: number, status: Exclude<AlertStatus, 'active'>) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<NodeStatus | 'all'>('all')
  const openIncidents = data.alerts.filter((alert) => alert.status !== 'resolved' || data.incidentEvents?.[alert.id]?.kind === 'resolved')
  const priorityIncidents = openIncidents.length
    ? [...openIncidents].sort(
        (a, b) =>
          Number(data.incidentEvents?.[b.id]?.kind === 'arrival') - Number(data.incidentEvents?.[a.id]?.kind === 'arrival') ||
          Number(
            canResolve(
              a,
              data.nodes.find((node) => node.id === a.node_id),
              data.summary,
            ),
          ) -
          Number(
            canResolve(
              b,
              data.nodes.find((node) => node.id === b.node_id),
              data.summary,
            ),
          ),
      )
    : data.alerts
  const nodes = data.nodes.filter(
    (node) =>
      `${node.id} ${node.name} ${node.location_description}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === 'all' || node.computed_status === filter),
  )
  const metrics = [
    {
      label: 'Monitored nodes',
      value: data.summary.total_nodes,
      icon: Radio,
      kind: 'total',
      sub: `${data.summary.demo_nodes} simulated`,
    },
    {
      label: 'Safe',
      value: data.summary.safe,
      icon: CircleCheck,
      kind: 'safe',
      sub: 'Fresh normal readings',
    },
    {
      label: 'Hazardous',
      value: data.summary.hazard,
      icon: ShieldAlert,
      kind: 'hazard',
      sub: 'Measured threshold events',
    },
    {
      label: 'Offline',
      value: data.summary.offline,
      icon: Unplug,
      kind: 'offline',
      sub: 'Telemetry overdue',
    },
    {
      label: 'Active incidents',
      value: data.summary.active_incidents,
      icon: Activity,
      kind: 'active',
      sub: `${data.summary.acknowledged_incidents} acknowledged`,
    },
  ]
  return (
    <>
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div
            className={`metric ${metric.kind}`}
            key={metric.label}
            data-testid={`metric-${metric.kind}`}
          >
            <div className="metric-top">
              <span>{metric.label}</span>
              <metric.icon size={18} />
            </div>
            <strong>{metric.value.toString().padStart(2, '0')}</strong>
            <small>{metric.sub}</small>
          </div>
        ))}
      </div>
      <IncidentRibbon data={data} disabled={disabled} onOpen={onAlerts} />
      {data.nodes.length > 0 && (
        <SensorOverview
          sample={data.sample}
          node={data.nodes.find((node) => node.id === focusedId) || data.nodes[0]}
          nodes={data.nodes}
          thresholds={data.summary.demo_thresholds}
          snapshotCurrent={!disabled}
          onFocus={onFocus}
          onInspect={onSelect}
        />
      )}
      <div className="overview-grid">
        <NodeMap
          nodes={data.nodes}
          thresholds={data.summary.demo_thresholds}
          snapshotCurrent={!disabled}
          region={data.summary.demo_session?.region}
          onSelect={onSelect}
        />
        <section className="recent-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">INCIDENT STREAM</span>
              <h2>Recent alerts</h2>
            </div>
            <button
              className="icon-button"
              aria-label="View all alerts"
              title="View all alerts"
              onClick={onAlerts}
            >
              <ArrowRight size={18} />
            </button>
          </div>
          <AlertList
            alerts={priorityIncidents.slice(0, 4)}
            data={data}
            compact
            busy={busy}
            disabled={disabled}
            onSelect={onSelect}
            onAction={onAction}
          />
          <button className="feed-footer" onClick={onAlerts}>
            View incident log <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <section className="nodes-section">
        <div className="section-heading list-heading">
          <div>
            <span className="eyebrow">ASSET REGISTER</span>
            <h2>
              Monitored manholes <span className="count-label">{data.nodes.length}</span>
            </h2>
          </div>
          <div className="list-controls">
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="Search manholes"
                placeholder="Search nodes or locations"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              aria-label="Filter node status"
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
            >
              <option value="all">All statuses</option>
              <option value="safe">Safe</option>
              <option value="hazard">Hazard</option>
              <option value="offline">Offline</option>
              <option value="unknown">Partial data</option>
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="node-table">
            <thead>
              <tr>
                <th>Node / location</th>
                <th>Communication / safety</th>
                <th>Methane</th>
                <th>H2S</th>
                <th>Water height</th>
                <th>{data.sample ? 'Sample timeline' : 'Last telemetry'}</th>
                <th>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const methane = gas(node, 'methane'),
                  h2s = gas(node, 'h2s')
                return (
                  <tr key={node.id} data-testid={`node-${node.id}`}>
                    <td>
                      <button className="asset-button" onClick={() => onSelect(node.id)}>
                        <span className={`node-symbol ${node.computed_status}`}>
                          <Radio size={17} />
                        </span>
                        <span>
                          <strong>{node.id}</strong>
                          <small>
                            {node.name}{' '}
                            <span className="source-mini">{node.is_demo ? 'SIM' : 'HW'}</span>
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <StatusBadge status={node.computed_status} />
                      <small className={`connectivity ${node.connectivity}`}>
                        {node.connectivity} · {node.reading_freshness}
                      </small>
                      {node.connectivity === 'offline' &&
                        node.last_measured_safety === 'hazard' && (
                          <small className="last-hazard">Last measured hazard</small>
                        )}
                    </td>
                    <td className={!methane.sensor.fresh ? 'stale-value' : ''}>
                      {readingValue(methane.sensor, methane.unit)}
                      {methane.sensor.value !== null && !methane.sensor.fresh && (
                        <small>Stale</small>
                      )}
                    </td>
                    <td className={!h2s.sensor.fresh ? 'stale-value' : ''}>
                      {readingValue(h2s.sensor, h2s.unit)}
                      {h2s.sensor.value !== null && !h2s.sensor.fresh && <small>Stale</small>}
                    </td>
                    <td className={!node.sensors.water_level_cm.fresh ? 'stale-value' : ''}>
                      {readingValue(node.sensors.water_level_cm, 'cm')}
                    </td>
                    <td className="table-timestamp">{dateTime(node.last_seen_at)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Inspect ${node.id}`}
                        title={`Inspect ${node.id}`}
                        onClick={() => onSelect(node.id)}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!nodes.length && (
          <div className="empty-state">
            <Search size={24} />
            <h3>No matching nodes</h3>
            <p>There are no manholes in this view.</p>
          </div>
        )}
        <div className="table-footer">
          <span>
            {nodes.length} of {data.nodes.length} nodes
          </span>
          <span>
            <CircleHelp size={13} /> {data.summary.unknown} partial / unknown
          </span>
        </div>
      </section>
    </>
  )
}
