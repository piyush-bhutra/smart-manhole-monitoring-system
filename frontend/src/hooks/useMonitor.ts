import { useCallback, useEffect, useRef, useState } from 'react'
import { IncidentTracker } from '../services/incidentEvents'
import { api } from '../services/api'
import type { MonitorNode, Range, Reading, Snapshot } from '../types/api'

export function useMonitor(selectedId: string | null, range: Range) {
  const tracker = useRef(new IncidentTracker())
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<{
    node: MonitorNode
    readings: Reading[]
    range: Range
  } | null>(null)
  const [detailError, setDetailError] = useState('')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    let active: AbortController | null = null
    setLoading(true)
    // A retry does not revalidate retained detail. Clear its error only on success.
    async function load() {
      active = new AbortController()
      const signal = AbortSignal.any([active.signal, AbortSignal.timeout(12000)])
      try {
        const [summary, nodes, alerts] = await Promise.all([
          api.summary(signal),
          api.nodes(signal),
          api.alerts(signal),
        ])
        if (!alive) return
        setData({ summary, nodes, alerts, incidentEvents: tracker.current.update(alerts) })
        setError('')
        if (selectedId) {
          try {
            const [node, readings] = await Promise.all([
              api.node(selectedId, signal),
              api.history(selectedId, range, signal),
            ])
            if (alive) {
              setDetail({ node, readings, range })
              setDetailError('')
            }
          } catch (failure) {
            if (alive)
              setDetailError(
                failure instanceof Error ? failure.message : 'Node detail unavailable.',
              )
          }
        }
      } catch (failure) {
        if (alive)
          setError(failure instanceof Error ? failure.message : 'Cannot reach the monitoring API.')
      } finally {
        active?.abort()
        if (alive) {
          setLoading(false)
          timer = setTimeout(load, 5000)
        }
      }
    }
    void load()
    return () => {
      alive = false
      clearTimeout(timer)
      active?.abort()
    }
  }, [selectedId, range, revision])

  return {
    data,
    detail: detail?.node.id === selectedId && detail.range === range ? detail : null,
    error,
    detailError,
    loading,
    refresh,
  }
}
