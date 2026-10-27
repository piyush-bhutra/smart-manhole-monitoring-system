import { ArrowUpRight, Radio, ShieldAlert } from 'lucide-react'
import type { Snapshot } from '../types/api'
import { hazardLabels } from '../utils'

export function IncidentRibbon({ data, disabled, onOpen }: { data: Snapshot; disabled: boolean; onOpen?: () => void }) {
  const arrivals = data.alerts.filter(a => data.incidentEvents?.[a.id]?.kind === 'arrival' && a.status === 'active')
  const newest = arrivals[0]
  const active = data.alerts.filter(a => a.status === 'active').length
  return <div className={`incident-ribbon ${newest && !disabled ? 'has-arrival' : ''}`}>
    <span className="ribbon-signal"><Radio size={22} /></span>
    <div className="ribbon-copy"><span className="eyebrow">{data.sample ? 'SAMPLE INCIDENT WATCH' : 'LIVE INCIDENT WATCH'}</span>
      <strong>{disabled ? 'Connection interrupted · last known incidents' : newest ? `${hazardLabels[newest.alert_type]} · ${newest.node_id}` : active ? `${active} incident${active === 1 ? '' : 's'} awaiting acknowledgement` : 'No incidents awaiting acknowledgement'}</strong>
      <span>Workflow status does not establish physical safety.</span>
    </div>
    <div className="ribbon-count"><ShieldAlert size={16} /><b>{String(active).padStart(2, '0')}</b><span>ACTIVE</span></div>
    {onOpen && <button className="button secondary" onClick={onOpen}>Review incidents <ArrowUpRight size={16} /></button>}
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{!disabled && newest ? `${arrivals.length} new incident${arrivals.length === 1 ? '' : 's'}. ${hazardLabels[newest.alert_type]} at ${newest.node_id}.` : ''}</span>
  </div>
}
