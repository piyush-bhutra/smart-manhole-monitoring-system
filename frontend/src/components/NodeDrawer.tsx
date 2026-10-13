import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Flame,
  MapPin,
  ShieldCheck,
  Waves,
  Wind,
  X,
  AlertCircle,
  Clock,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AlertStatus, MonitorNode, Range, Reading, SensorField, Snapshot } from '../types/api'
import { dateTime, gas, readingValue, time } from '../utils'
import { AlertList } from './AlertList'
import { StatusBadge } from './StatusBadge'
import { historySeries } from '../services/history'

const chartFields: { id: SensorField; label: string; unit: string }[] = [
  { id: 'methane_ppm', label: 'Methane', unit: 'ppm' },
  { id: 'h2s_ppm', label: 'Hydrogen sulfide', unit: 'ppm' },
  { id: 'water_level_cm', label: 'Water height', unit: 'cm' },
  { id: 'methane_raw', label: 'Methane raw / uncalibrated', unit: 'raw' },
  { id: 'h2s_raw', label: 'H2S raw / uncalibrated', unit: 'raw' },
  { id: 'cover_displaced', label: 'Cover displacement', unit: '0 seated / 1 displaced' },
]

export function NodeDrawer({
  selectedId,
  detail,
  data,
  range,
  error,
  connectionError,
  notice,
  busy,
  onRange,
  onClose,
  onAction,
}: {
  selectedId: string
  detail: { node: MonitorNode; readings: Reading[] } | null
  data: Snapshot
  range: Range
  error: string
  connectionError: boolean
  notice: { error: boolean; text: string } | null
  busy: boolean
  onRange: (range: Range) => void
  onClose: () => void
  onAction: (id: number, status: Exclude<AlertStatus, 'active'>) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [field, setField] = useState<SensorField>(() => {
    const node = data.nodes.find((node) => node.id === selectedId)
    const fields: SensorField[] = [
      'methane_ppm',
      'methane_raw',
      'h2s_ppm',
      'h2s_raw',
      'water_level_cm',
      'cover_displaced',
    ]
    return fields.find((field) => node?.sensors[field].value != null) || 'methane_ppm'
  })
  useEffect(() => {
    const element = dialog.current!
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => {
      element.close()
      document.body.style.overflow = original
    }
  }, [])
  const node = detail?.node || data.nodes.find((node) => node.id === selectedId)
  const series = chartFields.find((item) => item.id === field)!
  const chartData = historySeries(
    detail?.readings || [],
    field,
    data.summary.sensor_stale_seconds || 300,
  )
  const hasChartData = chartData.some((reading) => reading.value !== null)
  const threshold =
    field === 'methane_ppm'
      ? data.summary.demo_thresholds.methane
      : field === 'h2s_ppm'
        ? data.summary.demo_thresholds.h2s
        : field === 'water_level_cm'
          ? data.summary.demo_thresholds.overflow
          : null
  return (
    <dialog
      ref={dialog}
      className="node-drawer"
      aria-labelledby="detail-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="drawer-content">
        <header className="drawer-header">
          <div>
            <span className="eyebrow">ASSET DETAIL</span>
            <h2 id="detail-title">{selectedId}</h2>
          </div>
          <button
            autoFocus
            className="icon-button"
            title="Close node details"
            aria-label="Close node details"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        {notice && (
          <div
            className={`drawer-feedback ${notice.error ? 'error' : ''}`}
            role={notice.error ? 'alert' : 'status'}
          >
            <AlertCircle size={16} />
            {notice.text}
          </div>
        )}
        {node && (
          <>
            <div className="drawer-identity">
              <div>
                <h3>{node.name}</h3>
                <p>
                  <MapPin size={14} />
                  {node.latitude !== null && node.longitude !== null
                    ? `${node.latitude.toFixed(4)}, ${node.longitude.toFixed(4)}`
                    : 'Location unavailable'}
                </p>
              </div>
              <div className="node-state">
                <span className={`connectivity ${node.connectivity}`}>{node.connectivity}</span>
                <StatusBadge
                  status={node.safety_status}
                  label={node.safety_status === 'unknown' ? 'Safety unknown' : undefined}
                />
              </div>
            </div>
            <div className="source-banner">
              <span className={`status-dot ${node.is_demo ? 'demo' : 'hardware'}`} />
              <strong>{node.is_demo ? 'SIMULATED DATA' : 'HARDWARE TELEMETRY'}</strong>
              <span>{node.location_description}</span>
            </div>
            <div className="telemetry-time">
              <Clock size={14} />
              Last telemetry: {dateTime(node.last_seen_at)}
              {node.reading_freshness === 'stale' && (
                <span>Stale · last measured {node.last_measured_safety}</span>
              )}
            </div>
          </>
        )}
        {connectionError && (
          <div className="inline-error" role="alert">
            <AlertCircle size={17} />
            API disconnected. Displayed values are the last successful snapshot.
          </div>
        )}
        {error && (
          <div className="inline-error" role="alert">
            <AlertCircle size={17} />
            {error}
          </div>
        )}
        {!detail && !error && (
          <div className="loading-line" role="status">
            Loading node history...
          </div>
        )}
        {node && (
          <>
            <div className="sensor-grid">
              {[
                { label: 'Methane', icon: Flame, ...gas(node, 'methane') },
                { label: 'Hydrogen sulfide', icon: Wind, ...gas(node, 'h2s') },
                {
                  label: 'Water height',
                  icon: Waves,
                  sensor: node.sensors.water_level_cm,
                  unit: 'cm',
                },
                {
                  label: 'Manhole cover',
                  icon: ShieldCheck,
                  sensor: node.sensors.cover_displaced,
                  unit: '',
                },
              ].map((item) => (
                <article
                  className={`sensor-card ${!item.sensor.fresh ? 'stale' : ''}`}
                  key={item.label}
                >
                  <div>
                    <item.icon size={17} />
                    <span>{item.label}</span>
                  </div>
                  <strong>{readingValue(item.sensor, item.unit)}</strong>
                  <small>
                    {item.sensor.value === null
                      ? 'No measurement'
                      : !item.sensor.fresh
                        ? 'Stale observation'
                        : item.unit === 'raw'
                          ? 'Raw / uncalibrated'
                          : item.sensor.fresh
                            ? 'Fresh observation'
                            : 'Stale observation'}
                  </small>
                  <time>{dateTime(item.sensor.received_at)}</time>
                </article>
              ))}
            </div>
            <section className="history-section">
              <div className="section-heading">
                <h3>
                  <Activity size={17} />
                  Sensor history
                </h3>
                <div className="segmented compact">
                  {(['1h', '24h', '7d'] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={range === value}
                      onClick={() => onRange(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="chart-heading">
                <select
                  aria-label="Chart sensor"
                  value={field}
                  onChange={(event) => setField(event.target.value as SensorField)}
                >
                  {chartFields.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} ({item.unit})
                    </option>
                  ))}
                </select>
                <small>{detail?.readings.length ?? 0} observations</small>
              </div>
              <div className="chart-wrap">
                {detail && hasChartData ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 15, right: 15, left: -16, bottom: 0 }}
                      accessibilityLayer
                    >
                      <CartesianGrid stroke="#29383e" strokeDasharray="3 5" vertical={false} />
                      <XAxis
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(value) =>
                          range === '7d'
                            ? new Date(value).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })
                            : time(new Date(value).toISOString())
                        }
                        stroke="#81959e"
                        fontSize={11}
                        minTickGap={48}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#81959e"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={52}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#162226',
                          border: '1px solid #34474d',
                          borderRadius: 6,
                          color: '#edf5f6',
                        }}
                        labelFormatter={(value) => dateTime(new Date(Number(value)).toISOString())}
                        formatter={(value) => [`${value} ${series.unit}`, series.label]}
                      />
                      {threshold !== null && (
                        <ReferenceLine
                          y={threshold}
                          stroke="#e6ae5a"
                          strokeDasharray="4 4"
                          label={{
                            value: 'Demo threshold',
                            fill: '#e6ae5a',
                            fontSize: 10,
                            position: 'insideTopRight',
                          }}
                        />
                      )}
                      <Line
                        dataKey="value"
                        type={field === 'cover_displaced' ? 'stepAfter' : 'linear'}
                        stroke="#45d7bf"
                        strokeWidth={2}
                        dot={{ r: 2, fill: '#45d7bf', strokeWidth: 0 }}
                        activeDot={{ r: 4 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state">
                    <Activity size={25} />
                    <p>
                      {detail
                        ? 'No measurements for this channel in the selected range.'
                        : 'Waiting for historical data...'}
                    </p>
                  </div>
                )}
              </div>
              <div className="chart-footer">
                <span>
                  {series.unit === 'raw'
                    ? 'Raw / uncalibrated values'
                    : node.is_demo
                      ? 'Synthetic demonstration history'
                      : 'Received hardware history'}
                </span>
                <span>Local time · gaps indicate missing telemetry</span>
              </div>
            </section>
            <section className="related-alerts">
              <div className="section-heading">
                <h3>Related incidents</h3>
                <span className="count-label">
                  {data.alerts.filter((alert) => alert.node_id === node.id).length}
                </span>
              </div>
              <AlertList
                alerts={data.alerts.filter((alert) => alert.node_id === node.id)}
                data={data}
                busy={busy}
                disabled={connectionError}
                onSelect={() => dialog.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                onAction={onAction}
              />
            </section>
          </>
        )}
      </div>
    </dialog>
  )
}
