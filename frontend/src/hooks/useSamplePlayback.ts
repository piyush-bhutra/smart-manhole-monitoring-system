import { useEffect, useState } from 'react'
import { IncidentTracker } from '../services/incidentEvents'
import { buildSampleFrame, type SampleScenarioId } from '../services/sampleScenarios'

/** Mounted once per playback run; its clock and incident bookkeeping never touch live data. */
export function useSamplePlayback(id: SampleScenarioId) {
  const [startedAt] = useState(() => Date.now())
  const [frame, setFrame] = useState(() => buildSampleFrame(id, 0, startedAt))
  useEffect(() => {
    const tracker = new IncidentTracker()
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const next = buildSampleFrame(id, (Date.now() - startedAt) / 1000, startedAt)
      next.snapshot.incidentEvents = tracker.update(next.snapshot.alerts)
      setFrame(next)
      if (!next.completed) timer = setTimeout(tick, 1000)
    }
    tick()
    return () => clearTimeout(timer)
  }, [id, startedAt])
  return frame
}
