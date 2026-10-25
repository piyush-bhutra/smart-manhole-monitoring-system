import { useMemo, type ReactNode, type CSSProperties } from 'react'
import type { IncidentEvent } from '../services/incidentEvents'
import type { Alert } from '../types/api'

export function IncidentShell({ alert, event, paused, children }: { alert: Alert; event?: IncidentEvent; paused: boolean; children: ReactNode }) {
  const at = event?.at
  // A remounted card resumes the remaining event; polling never resets this delay.
  const delay = useMemo(() => at === undefined || paused ? '0ms' : `${-Math.max(0, Date.now() - at)}ms`, [at, paused])
  return <article className={`incident ${alert.status} incident-${alert.alert_type} ${paused ? 'motion-paused' : ''}`}
    data-testid={`alert-${alert.id}`} data-event={paused ? undefined : event?.kind} data-event-at={at}
    style={{ '--event-delay': delay } as CSSProperties}>
    {children}
  </article>
}
