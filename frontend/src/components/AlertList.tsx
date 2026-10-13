import { ArrowUpRight, Check, CheckCheck, Flame, Waves, ShieldAlert, Wind } from 'lucide-react'
import type { Alert, AlertStatus, Snapshot } from '../types/api'
import { canResolve, dateTime, hazardLabels, resolutionReason } from '../utils'
import { StatusBadge } from './StatusBadge'

const icons = { methane: Flame, h2s: Wind, overflow: Waves, cover: ShieldAlert }

export function AlertList({
  alerts,
  data,
  compact = false,
  busy,
  disabled,
  onSelect,
  onAction,
}: {
  alerts: Alert[]
  data: Snapshot
  compact?: boolean
  busy: boolean
  disabled: boolean
  onSelect: (id: string) => void
  onAction: (id: number, status: Exclude<AlertStatus, 'active'>) => void
}) {
  if (!alerts.length)
    return (
      <div className="empty-state">
        <CheckCheck size={26} />
        <h3>No incidents here</h3>
        <p>No records match the current view.</p>
      </div>
    )
  return (
    <div className={compact ? 'alert-feed' : 'incident-list'}>
      {alerts.map((alert) => {
        const Icon = icons[alert.alert_type]
        const node = data.nodes.find((node) => node.id === alert.node_id)
        const resolvable = canResolve(alert, node, data.summary)
        return (
          <article
            key={alert.id}
            className={`incident ${alert.status}`}
            data-testid={`alert-${alert.id}`}
          >
            <div className="incident-icon">
              <Icon size={18} />
            </div>
            <div className="incident-main">
              <div className="incident-title">
                <strong>{hazardLabels[alert.alert_type]}</strong>
                {!compact && <span className="severity">{alert.severity}</span>}
              </div>
              <button className="text-button node-link" onClick={() => onSelect(alert.node_id)}>
                {alert.node_id} <ArrowUpRight size={12} />
              </button>
              {!compact && (
                <span className="muted node-name">{node?.name || 'Registered node'}</span>
              )}
              <div className="incident-time">
                {compact ? 'Observed ' : 'Triggered '}
                {dateTime(compact ? alert.last_observed_at : alert.triggered_at)}{' '}
                <span>· {alert.source === 'simulator' ? 'Simulated' : 'Hardware'}</span>
              </div>
              {compact && alert.status !== 'resolved' && (
                <small className="incident-condition">
                  {resolvable
                    ? 'Measured clear · awaiting closure'
                    : node?.connectivity === 'offline'
                      ? 'Stale · clearance unconfirmed'
                      : 'No fresh normal observation'}
                </small>
              )}
              {!compact && (
                <div className="incident-observed">
                  Last observed {dateTime(alert.last_observed_at)}
                  {alert.notes && <span> · {alert.notes}</span>}
                </div>
              )}
            </div>
            <div className="incident-end">
              <StatusBadge status={alert.status} />
              {!compact && alert.status !== 'resolved' && (
                <div className="incident-clearance">
                  <div className="incident-actions">
                    {alert.status === 'active' && (
                      <button
                        className="button small secondary"
                        disabled={busy || disabled}
                        onClick={() => onAction(alert.id, 'acknowledged')}
                      >
                        <Check size={14} />
                        Acknowledge
                      </button>
                    )}
                    <button
                      className="button small secondary"
                      disabled={busy || disabled || !resolvable}
                      onClick={() => onAction(alert.id, 'resolved')}
                      title={
                        resolvable
                          ? 'Resolve incident'
                          : 'Requires an online node and fresh normal reading for this hazard'
                      }
                    >
                      <CheckCheck size={14} />
                      Resolve
                    </button>
                  </div>
                  {!resolvable && (
                    <small className="resolution-reason">
                      {resolutionReason(alert, node, data.summary)}
                    </small>
                  )}
                </div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
