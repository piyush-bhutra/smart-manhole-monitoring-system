import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { divIcon, type Marker as LeafletMarker } from 'leaflet'
import { Marker, Tooltip } from 'react-leaflet'
import { Check, Unplug, CircleHelp } from 'lucide-react'
import type { MonitorNode, Summary } from '../types/api'
import { conditionView } from '../services/conditionView'
import { hazardLabels } from '../utils'
import { HazardSymbol } from './HazardSymbol'

export function HazardMarker({ node, thresholds, snapshotCurrent, onSelect }: { node: MonitorNode; thresholds: Summary['demo_thresholds']; snapshotCurrent: boolean; onSelect: (id: string) => void }) {
  const marker = useRef<LeafletMarker>(null)
  const view = conditionView(node, thresholds, snapshotCurrent)
  const { element, icon } = useMemo(() => {
    const element = document.createElement('div')
    return { element, icon: divIcon({ html: element, className: 'pulse-map-icon', iconSize: [50, 50], iconAnchor: [25, 25] }) }
  }, [])
  const historical = view.mode === 'offline' || view.mode === 'snapshot-stale'
  const symbols = historical ? view.lastKnownHazards : view.hazards
  const label = historical ? `${view.mode === 'offline' ? 'Offline' : 'API unavailable'} · safety unconfirmed` : view.mode === 'safe' ? 'Fresh normal readings' : symbols.length ? symbols.map(h => hazardLabels[h]).join(' · ') : 'Partial data · safety unconfirmed'
  useEffect(() => {
    const element = marker.current?.getElement()
    element?.setAttribute('title', `${node.id} · ${label}`)
    element?.setAttribute('aria-label', `${node.id} · ${label}`)
  }, [node.id, label])
  return <>
    <Marker ref={marker} position={[node.latitude!, node.longitude!]} icon={icon} title={`${node.id} · ${label}`} eventHandlers={{ click: () => onSelect(node.id) }}>
      <Tooltip direction="top" offset={[0, -22]}><strong>{node.id} · {node.name}</strong><br />{label}<br />{node.is_demo ? 'Simulated' : 'Hardware'}</Tooltip>
    </Marker>
    {createPortal(<div className={`hazard-marker mode-${view.mode} ${symbols.length > 1 ? 'multiple' : ''}`} data-testid={`map-${node.id}`} data-mode={view.mode}>
      <span className="marker-halo" />
      <div className="marker-symbols">{symbols.length ? symbols.map(kind => <HazardSymbol key={kind} kind={kind} moving={!historical} />) : view.mode === 'safe' ? <Check size={23} /> : historical ? <Unplug size={22} /> : <CircleHelp size={23} />}</div>
      {historical && symbols.length > 0 && <span className="marker-disconnected"><Unplug size={11} /></span>}
      <span className="marker-id">{node.id}</span><span className="sr-only">{label}</span>
    </div>, element)}
  </>
}
