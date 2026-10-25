import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import type { Snapshot } from '../types/api'
import { IncidentAudio, SoundPolicy, type SoundState } from '../services/incidentSound'

export function SoundControl({ data, disconnected }: { data: Snapshot | null; disconnected: boolean }) {
  const [audio] = useState(() => new IncidentAudio())
  const [policy] = useState(() => new SoundPolicy())
  const [state, setState] = useState<SoundState>('muted')
  useEffect(() => {
    audio.onChange = setState
    return () => { audio.onChange = () => {}; audio.dispose() }
  }, [audio])
  useEffect(() => {
    if (policy.update(data, !disconnected, audio.state === 'enabled')) audio.play()
  }, [data, disconnected, audio, policy])
  const enabled = state === 'enabled'
  const label = state === 'unavailable' ? 'Audio unavailable' : state === 'blocked' ? 'Enable again'
    : state === 'enabling' ? 'Cancel audio' : enabled ? 'Sound on' : 'Sound off'
  const description = state === 'unavailable' ? 'This browser cannot play alert sounds. Visual alerts remain available.'
    : state === 'blocked' ? 'Audio was interrupted or blocked. Click to try again. Visual alerts remain available.'
      : 'Optional cue for new critical incidents only. Existing alerts and reconnects are silent. Resets to off on reload.'
  return <button className={`sound-control ${enabled ? 'enabled' : ''}`} type="button"
    aria-label="Alert sounds" aria-pressed={enabled} title={description}
    disabled={state === 'unavailable'}
    onClick={() => { if (enabled || state === 'enabling') audio.mute(); else void audio.enable() }}>
    {enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
    <span>{label}<small>{enabled ? 'NEW CRITICAL ONLY' : 'OPERATOR AUDIO'}</small></span>
    <i aria-hidden="true" />
    <span className="sr-only" role="status">{label}. {description}</span>
  </button>
}
