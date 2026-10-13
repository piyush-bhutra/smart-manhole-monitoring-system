import type { AlertStatus, NodeStatus } from '../types/api'
import { statusLabels } from '../utils'

export function StatusBadge({
  status,
  label,
}: {
  status: NodeStatus | AlertStatus
  label?: string
}) {
  return (
    <span className={`status-badge ${status}`}>
      <span className="status-dot" />
      {label || statusLabels[status]}
    </span>
  )
}
