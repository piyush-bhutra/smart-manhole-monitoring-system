import type { ChannelCondition } from '../services/conditionView'

/** A comparison to a configured demo limit, never capacity or calibrated raw data. */
export function ThresholdGauge({ kind, value, threshold, unit, condition }: {
  kind: string; value: number | boolean | null; threshold: number; unit: string; condition: ChannelCondition
}) {
  const comparable = unit !== 'raw' && typeof value === 'number' && Number.isFinite(value) && threshold > 0
  const percent = comparable ? Math.round(value / threshold * 100) : null
  const current = condition === 'safe' || condition === 'hazard'
  return <div className={`threshold-gauge gauge-${condition}`} data-testid={`gauge-${kind}`} data-current={current}>
    <div className="gauge-track" aria-hidden="true">
      {percent !== null && <span className="gauge-fill" style={{ width: `${Math.min(Math.max(percent, 0), 200) / 2}%` }} />}
      <i className="gauge-limit" />
    </div>
    <div className="gauge-label"><span>{percent === null ? 'No calibrated comparison' : `${current ? '' : 'Last known · '}${percent}% of demo threshold`}</span><span>Limit {threshold.toLocaleString()} {unit === 'raw' ? 'ppm' : unit}</span></div>
  </div>
}
