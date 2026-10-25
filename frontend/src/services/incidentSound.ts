import type { Snapshot } from '../types/api'

/** Consumes the shared visual incident events, including while muted. Never queues audio. */
export class SoundPolicy {
  private seen = new Set<number>()
  private ready = false
  private lastSnapshot = 0
  private lastCue = -Infinity

  update(data: Snapshot | null, connected: boolean, enabled: boolean, now = Date.now()) {
    if (!connected || !data) { this.ready = false; return false }
    const baseline = !this.ready || now - this.lastSnapshot > 20000
    let arrival = false
    for (const alert of data.alerts) {
      if (!this.seen.has(alert.id) && alert.status === 'active' && alert.severity === 'critical'
        && data.incidentEvents?.[alert.id]?.kind === 'arrival') arrival = true
      this.seen.add(alert.id)
    }
    this.ready = true
    this.lastSnapshot = now
    if (baseline || !enabled || !arrival || now - this.lastCue < 3000) return false
    this.lastCue = now
    return true
  }
}

export type SoundState = 'muted' | 'enabling' | 'enabled' | 'unavailable' | 'blocked'

/** Created lazily by a user gesture; finite, low-gain sine tones with soft envelopes. */
export class IncidentAudio {
  state: SoundState = 'muted'
  onChange: (state: SoundState) => void = () => {}
  private context: AudioContext | null = null
  private voices = new Set<OscillatorNode>()
  private generation = 0

  private setState(state: SoundState) { this.state = state; this.onChange(state) }

  async enable() {
    const generation = ++this.generation
    this.setState('enabling')
    try {
      if (!globalThis.AudioContext) { this.setState('unavailable'); return }
      const context = this.context ?? new AudioContext()
      this.context = context
      context.onstatechange = () => {
        if (this.state === 'enabled' && context.state !== 'running') this.mute('blocked')
      }
      await context.resume()
      if (generation !== this.generation) return
      this.setState(context.state === 'running' ? 'enabled' : 'blocked')
    } catch { if (generation === this.generation) this.mute('blocked') }
  }

  mute(state: SoundState = 'muted') {
    ++this.generation
    for (const voice of this.voices) {
      voice.disconnect()
      try { voice.stop() } catch { /* Already ended. */ }
    }
    this.voices.clear()
    this.setState(state)
  }

  play() {
    const context = this.context
    if (this.state !== 'enabled' || context?.state !== 'running') return
    try {
      for (const [offset, frequency] of [[0, 660], [.23, 880]]) {
        const voice = context.createOscillator()
        const envelope = context.createGain()
        const start = context.currentTime + offset
        voice.type = 'sine'
        voice.frequency.value = frequency
        envelope.gain.setValueAtTime(0, start)
        envelope.gain.linearRampToValueAtTime(.045, start + .025)
        envelope.gain.linearRampToValueAtTime(0, start + .19)
        voice.connect(envelope)
        envelope.connect(context.destination)
        this.voices.add(voice)
        voice.onended = () => { voice.disconnect(); envelope.disconnect(); this.voices.delete(voice) }
        voice.start(start)
        voice.stop(start + .2)
      }
    } catch { this.mute('blocked') }
  }

  dispose() {
    this.mute()
    const context = this.context
    this.context = null
    if (context) { context.onstatechange = null; void context.close().catch(() => {}) }
  }
}
