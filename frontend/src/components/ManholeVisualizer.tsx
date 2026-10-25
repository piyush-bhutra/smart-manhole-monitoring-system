import { useId } from 'react'
import { CircleHelp, ShieldCheck, Unplug, Waves, Wind, TriangleAlert } from 'lucide-react'
import type { ConditionView } from '../services/conditionView'
import { hazardLabels } from '../utils'

const modeLabels = {
  safe: 'Conditions normal', hazard: 'Attention required', unknown: 'Incomplete picture',
  offline: 'Connection lost', 'snapshot-stale': 'Snapshot paused',
}

export function ManholeVisualizer({ view, nodeId, threshold }: {
  view: ConditionView
  nodeId: string
  threshold: number
}) {
  const id = useId()
  const historical = view.mode === 'offline' || view.mode === 'snapshot-stale'
  const gasKnown = view.lastKnownHazards.some((kind) => kind === 'methane' || kind === 'h2s')
  const gasCurrent = view.hazards.some((kind) => kind === 'methane' || kind === 'h2s')
  const overflowing = view.waterRatio !== null && view.waterRatio >= 1
  // Threshold-relative schematic: no chamber dimensions or volumetric estimate are implied.
  const waterY = view.waterRatio === null ? 284 : 284 - Math.min(view.waterRatio, 1.18) * 124
  const Icon = view.mode === 'safe' ? ShieldCheck : view.mode === 'hazard' ? TriangleAlert
    : historical ? Unplug : CircleHelp
  return (
    <figure className={`manhole-visualizer mode-${view.mode}`} data-testid="manhole-visualizer" data-mode={view.mode}>
      <div className="figure-topline"><span>SECTION A—A</span><span>{nodeId} / CONDITION VIEW</span></div>
      <svg className="chamber-illustration" viewBox="0 0 520 330" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{nodeId}: {modeLabels[view.mode]}</title>
        <desc id={`${id}-desc`}>
          Schematic manhole cross-section, not to scale. {historical ? 'Historical observations only. Safety unconfirmed.' : ''}
          {view.hazards.map((kind) => hazardLabels[kind]).join('. ')}.
          {view.waterRatio === null ? 'Water level unavailable.' : 'Water height relative to the configured overflow threshold.'}
          {view.coverDisplaced === null ? 'Cover position unknown.' : view.channels.cover === 'stale' ? 'Cover position is a stale observation, not a current condition.' : ''}
        </desc>
        <defs>
          <pattern id={`${id}-soil`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <path d="M0 0V12" stroke="currentColor" strokeWidth="1" />
          </pattern>
          <pattern id={`${id}-grid`} width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M26 0H0V26" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
          <clipPath id={`${id}-chamber`}><path d="M169 144H351V274Q351 287 338 287H182Q169 287 169 274Z" /></clipPath>
        </defs>
        <rect x="28" y="23" width="464" height="280" fill={`url(#${id}-grid)`} className="drawing-grid" />
        <path d="M39 145H148V289H372V145H481" fill="none" className="soil-outline" strokeWidth="20" />
        <path d="M39 145H148V289H372V145H481" fill="none" stroke={`url(#${id}-soil)`} strokeWidth="20" className="soil-hatch" />
        <path d="M169 144H351V274Q351 287 338 287H182Q169 287 169 274Z" className="chamber-interior" />
        <g className="chamber-ladder" fill="none" strokeWidth="3" strokeLinecap="round">
          <path d="M326 157V270M343 157V270" />
          {[170, 190, 210, 230, 250, 270].map((y) => <path key={y} d={`M326 ${y}H343`} />)}
        </g>
        <path d="M100 234H169V260H100M351 234H420V260H351" className="chamber-pipes" strokeWidth="2" />
        {view.waterRatio !== null && (
          <g clipPath={`url(#${id}-chamber)`} className={`chamber-water ${view.channels.overflow === 'stale' ? 'is-stale' : ''}`}>
            <g style={{ transform: `translateY(${waterY}px)` }} className="water-height">
              <rect x="157" y="0" width="207" height="170" className="water-fill" />
              <path className="water-wave" d="M140 0Q160 -6 180 0T220 0T260 0T300 0T340 0T380 0T420 0V180H140Z" />
              <path className="water-ripple" d="M180 16h20m23 9h28m31-12h26m-108 30h17m46 4h25m14-13h19" />
            </g>
          </g>
        )}
        <path d="M158 145V276Q158 298 181 298H339Q362 298 362 276V145" fill="none" className="chamber-wall" strokeWidth="10" />
        <path d="M158 145V276Q158 298 181 298H339Q362 298 362 276V145" fill="none" className="chamber-wall-edge" strokeWidth="1.5" />
        <path d="M42 136H154M366 136H478" className="ground-line" strokeWidth="3" />
        <ellipse cx="260" cy="140" rx="112" ry="24" className="chamber-rim" />
        <ellipse cx="260" cy="137" rx="94" ry="16" className="chamber-opening" />
        <g className={`chamber-cover ${view.coverDisplaced === null ? 'is-unknown' : view.channels.cover === 'stale' ? 'is-stale' : ''}`} data-displaced={String(view.coverDisplaced)}>
          <path d="M153 116V126C153 156 367 156 367 126V116Z" className="cover-edge" />
          <ellipse cx="260" cy="116" rx="107" ry="25" className="cover-face" />
          <ellipse cx="260" cy="116" rx="94" ry="18" className="cover-inset" />
          <g className="cover-slots" strokeWidth="3" strokeLinecap="round">
            <path d="M190 111l25 12m0-19 32 22m0-23 32 22m0-23 31 21m0-17 19 12" />
          </g>
          <path d="M248 113h24" className="cover-handle" strokeWidth="4" strokeLinecap="round" />
        </g>
        {gasKnown && (
          <g className={`gas-cloud ${gasCurrent ? 'is-current' : 'is-stale'}`}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <circle key={index} className="gas-particle" cx={210 + index * 21} cy={108 - (index % 3) * 9} r={5 + index % 3 * 2}
                style={{ animationDelay: `${index * -0.53}s` }} />
            ))}
            <path d="M231 98q-13-12 0-24t0-24M283 106q12-12 0-24t0-24" className="gas-trail" fill="none" />
          </g>
        )}
        {overflowing && (
          <g className={`overflow-spill ${view.channels.overflow === 'hazard' ? 'is-current' : 'is-stale'}`} fill="none" strokeLinecap="round">
            <path d="M168 141q-35-9-42 2t-33 5M352 141q35-9 42 2t33 5" />
            <path className="overflow-drop" d="M132 156v9m260-7v10m-274-3v6m287-2v6" />
          </g>
        )}
        <g className="drawing-annotation" fill="none" strokeWidth="1">
          <path d="M374 160h63m-7 0v125m-5 0h10m-5-125-4 6m4-6 4 6" />
          <path d="M165 160H355" strokeDasharray="4 5" className="threshold-guide" />
          <path d="M92 82h55l35 20M55 236h41M263 298v15h48" />
          <circle cx="182" cy="102" r="2" /><circle cx="96" cy="236" r="2" />
        </g>
        <g className="drawing-label">
          <text x="52" y="72">COVER</text>
          <text x="40" y="225">INLET</text>
          <text x="443" y="211" transform="rotate(90 443 211)">{threshold} cm THRESHOLD</text>
          <text x="315" y="317">SCHEMATIC</text>
        </g>
        {view.waterRatio === null && <text x="260" y="244" textAnchor="middle" className="unknown-water">NO WATER READING</text>}
        {view.coverDisplaced === null && <text x="260" y="83" textAnchor="middle" className="unknown-cover">COVER UNKNOWN</text>}
      </svg>
      <figcaption>
        <div className="condition-headline"><Icon size={18} /><strong>{modeLabels[view.mode]}</strong></div>
        <div className="condition-tags">
          {view.hazards.map((kind) => <span key={kind} className={`condition-tag ${kind}`}>{kind === 'overflow' ? <Waves size={12} /> : kind === 'methane' || kind === 'h2s' ? <Wind size={12} /> : <TriangleAlert size={12} />}{hazardLabels[kind]}</span>)}
          {historical ? <span>Safety unconfirmed · last-known observations</span>
            : view.mode === 'safe' ? <span>All four safety channels report fresh normal values.</span>
              : view.mode === 'unknown' ? <span>Missing, stale or uncalibrated channels. Safety unconfirmed.</span> : null}
          {historical && view.lastKnownHazards.length > 0 && <span>Last measured: {view.lastKnownHazards.map((kind) => hazardLabels[kind]).join(' · ')}</span>}
        </div>
      </figcaption>
    </figure>
  )
}
