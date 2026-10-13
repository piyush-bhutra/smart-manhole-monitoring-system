import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { LocateFixed, MapPin } from 'lucide-react'
import type { MonitorNode } from '../types/api'
import { colors, statusLabels } from '../utils'
import { fallbackRegion } from '../config'

function MapBounds({ nodes, revision }: { nodes: MonitorNode[]; revision: number }) {
  const map = useMap()
  const coordinates = nodes
    .filter((node) => node.latitude !== null && node.longitude !== null)
    .map((node) => [node.latitude!, node.longitude!] as [number, number])
  const key = JSON.stringify(coordinates)
  useEffect(() => {
    const points = JSON.parse(key) as [number, number][]
    if (points.length) map.fitBounds(points, { padding: [55, 55], maxZoom: 16 })
    map.invalidateSize()
  }, [key, revision, map])
  return null
}

export function NodeMap({
  nodes,
  region = fallbackRegion,
  onSelect,
}: {
  nodes: MonitorNode[]
  region?: { name: string; center: [number, number] }
  onSelect: (id: string) => void
}) {
  const [revision, setRevision] = useState(0)
  const [tileError, setTileError] = useState(false)
  return (
    <section className="map-section" aria-label="Network map">
      <div className="section-heading">
        <div>
          <span className="eyebrow">GEOGRAPHIC OVERVIEW</span>
          <h2>
            Network map <span className="count-label">{nodes.length} nodes</span>
          </h2>
        </div>
        <button
          className="icon-button"
          title="Fit all nodes"
          aria-label="Fit all nodes"
          onClick={() => setRevision((value) => value + 1)}
        >
          <LocateFixed size={18} />
        </button>
      </div>
      <div className="map-wrap">
        <MapContainer
          center={region.center}
          zoom={15}
          scrollWheelZoom={false}
          className="network-map"
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            eventHandlers={{
              loading: () => setTileError(false),
              tileerror: () => setTileError(true),
            }}
          />
          <MapBounds nodes={nodes} revision={revision} />
          {nodes
            .filter((node) => node.latitude !== null && node.longitude !== null)
            .map((node) => (
              <CircleMarker
                key={node.id}
                center={[node.latitude!, node.longitude!]}
                radius={9}
                pathOptions={{
                  color: '#18292a',
                  weight: 3,
                  fillColor: colors[node.computed_status],
                  fillOpacity: 1,
                }}
                eventHandlers={{ click: () => onSelect(node.id) }}
              >
                <Tooltip direction="top">
                  <strong>{node.id}</strong>
                  <br />
                  {node.name}
                  <br />
                  {statusLabels[node.computed_status]} · {node.is_demo ? 'Simulated' : 'Hardware'}
                </Tooltip>
              </CircleMarker>
            ))}
        </MapContainer>
        <span className="map-location">
          <MapPin size={13} />{' '}
          {nodes.length && nodes.every((node) => node.is_demo)
            ? `${region.name} · Fictional placements`
            : 'Registered node locations'}
        </span>
        {tileError && (
          <div className="map-error" role="status">
            Map tiles unavailable. Node coordinates remain plotted.
          </div>
        )}
      </div>
      <div className="map-legend">
        {Object.entries(colors).map(([status, color]) => (
          <span key={status}>
            <i style={{ background: color }} />
            {statusLabels[status as keyof typeof colors]}
          </span>
        ))}
      </div>
    </section>
  )
}
