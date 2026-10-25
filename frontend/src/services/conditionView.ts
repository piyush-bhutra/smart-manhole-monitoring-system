import type { Hazard, MonitorNode, Summary } from '../types/api'

export type ChannelCondition = 'safe' | 'hazard' | 'raw' | 'unknown' | 'stale'
export type ConditionMode = 'safe' | 'hazard' | 'unknown' | 'offline' | 'snapshot-stale'

/** Presentation only: backend observations and thresholds remain authoritative. */
export function conditionView(
  node: MonitorNode,
  thresholds: Summary['demo_thresholds'],
  snapshotCurrent: boolean,
) {
  const channels = {} as Record<Hazard, ChannelCondition>
  const hazards: Hazard[] = []
  const lastKnownHazards: Hazard[] = []
  const fields = {
    methane: 'methane_ppm', h2s: 'h2s_ppm',
    overflow: 'water_level_cm', cover: 'cover_displaced',
  } as const
  const online = node.connectivity === 'online'
  for (const kind of Object.keys(fields) as Hazard[]) {
    const sensor = node.sensors[fields[kind]]
    const value = sensor.value
    const measured = kind === 'cover'
      ? typeof value === 'boolean'
      : typeof value === 'number' && Number.isFinite(value) && value >= 0
    const unsafe = measured && (kind === 'cover'
      ? value === true
      : Number(value) >= thresholds[kind])
    if (unsafe) lastKnownHazards.push(kind)
    if (measured) {
      channels[kind] = !snapshotCurrent || !online || !sensor.fresh
        ? 'stale' : unsafe ? 'hazard' : 'safe'
    } else if (kind === 'methane' || kind === 'h2s') {
      const raw = node.sensors[`${kind}_raw`]
      channels[kind] = raw.value === null ? 'unknown'
        : !snapshotCurrent || !online || !raw.fresh ? 'stale' : 'raw'
    } else {
      channels[kind] = 'unknown'
    }
    if (channels[kind] === 'hazard') hazards.push(kind)
  }
  const mode: ConditionMode = !snapshotCurrent ? 'snapshot-stale'
    : !online ? 'offline'
      : hazards.length ? 'hazard'
        : Object.values(channels).every((value) => value === 'safe') && node.safety_status === 'safe'
          ? 'safe' : 'unknown'
  const water = node.sensors.water_level_cm.value
  const cover = node.sensors.cover_displaced.value
  return {
    mode, channels, hazards, lastKnownHazards,
    waterRatio: typeof water === 'number' && Number.isFinite(water) && water >= 0
      ? water / thresholds.overflow : null,
    coverDisplaced: typeof cover === 'boolean' ? cover : null,
  }
}

export type ConditionView = ReturnType<typeof conditionView>
