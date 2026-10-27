import { FlaskConical, Radio } from 'lucide-react'

export function WorkspaceMode({ sample, onChange, disabled = false }: {
  sample: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return <div className="workspace-mode" role="tablist" aria-label="Monitoring mode"
    onKeyDown={event => {
      if (disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      if (event.key.startsWith('Arrow') || (event.key === 'Home' && sample) || (event.key === 'End' && !sample)) onChange()
    }}>
    <button role="tab" tabIndex={sample ? -1 : 0} aria-selected={!sample} aria-controls="workspace-panel" id="live-mode-tab"
      onClick={() => { if (sample) onChange() }} disabled={disabled}>
      <Radio size={16} /> Live
    </button>
    <button role="tab" tabIndex={sample ? 0 : -1} aria-selected={sample} aria-controls="workspace-panel" id="sample-mode-tab"
      onClick={() => { if (!sample) onChange() }} disabled={disabled}>
      <FlaskConical size={16} /> Demo scenarios
    </button>
  </div>
}
