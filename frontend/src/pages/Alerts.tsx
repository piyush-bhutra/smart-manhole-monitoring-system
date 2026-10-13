import { useState } from 'react'
import { Search, ShieldAlert } from 'lucide-react'
import type { AlertStatus, Hazard, Snapshot } from '../types/api'
import { AlertList } from '../components/AlertList'

export function Alerts({
  data,
  busy,
  disabled,
  onSelect,
  onAction,
  focusId,
  onClearFocus,
}: {
  data: Snapshot
  busy: boolean
  disabled: boolean
  onSelect: (id: string) => void
  onAction: (id: number, status: Exclude<AlertStatus, 'active'>) => void
  focusId: number | null
  onClearFocus: () => void
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AlertStatus | 'all' | 'unresolved'>(
    focusId === null ? 'unresolved' : 'all',
  )
  const [type, setType] = useState<Hazard | 'all'>('all')
  const [severity, setSeverity] = useState('all')
  const filtered = data.alerts.filter(
    (alert) =>
      (focusId === null || alert.id === focusId) &&
      (status === 'all' ||
        (status === 'unresolved' ? alert.status !== 'resolved' : alert.status === status)) &&
      (type === 'all' || alert.alert_type === type) &&
      (severity === 'all' || alert.severity === severity) &&
      `${alert.node_id} ${data.nodes.find((node) => node.id === alert.node_id)?.name || ''} ${alert.alert_type}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  return (
    <section className="alerts-page">
      {focusId !== null && (
        <div className="focused-incident">
          Incident #{focusId}
          <button className="text-button" onClick={onClearFocus}>
            Show all incidents
          </button>
        </div>
      )}
      <div className="incident-summary">
        <ShieldAlert size={20} />
        <strong>{data.summary.unresolved_incidents} unresolved incidents</strong>
        <span>
          {data.summary.active_incidents} active <i />
          {data.summary.acknowledged_incidents} acknowledged
        </span>
      </div>
      <div className="filter-bar">
        <div className="segmented">
          {(['unresolved', 'active', 'acknowledged', 'resolved', 'all'] as const).map((value) => (
            <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>
              {value === 'all'
                ? 'All incidents'
                : value === 'unresolved'
                  ? 'Open incidents'
                  : value}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search alerts"
            placeholder="Search node or event"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">INCIDENT LOG</span>
          <h2>
            {filtered.length} incident{filtered.length === 1 ? '' : 's'}
          </h2>
        </div>
        <div className="list-controls">
          <select
            aria-label="Filter alert type"
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            <option value="all">All event types</option>
            <option value="methane">Methane</option>
            <option value="h2s">H2S</option>
            <option value="overflow">Overflow</option>
            <option value="cover">Cover displaced</option>
          </select>
          <select
            aria-label="Filter severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
          </select>
        </div>
      </div>
      <AlertList
        alerts={filtered}
        data={data}
        busy={busy}
        disabled={disabled}
        onSelect={onSelect}
        onAction={onAction}
      />
    </section>
  )
}
