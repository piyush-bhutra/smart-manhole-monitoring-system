import type { Hazard } from '../types/api'

/** Symbolic motion, never a gas concentration or physical displacement estimate. */
export function HazardSymbol({ kind, moving = false }: { kind: Hazard; moving?: boolean }) {
  return <svg className={`hazard-symbol symbol-${kind} ${moving ? 'is-moving' : ''}`} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {(kind === 'methane' || kind === 'h2s') && <>
      <path className="symbol-plume plume-one" d="M12 28c-7-8 7-9 0-18" />
      <path className="symbol-plume plume-two" d="M21 25c-7-8 7-9 0-18" />
      <path className="symbol-plume plume-three" d="M30 28c-7-8 7-9 0-18" />
      <path d="M8 33h24" /><circle cx="32" cy="7" r="2" />
    </>}
    {kind === 'overflow' && <>
      <path d="M8 9v24h24V9M5 9h8m14 0h8" />
      <g className="symbol-water"><path d="M9 23q5-5 11 0t11 0M9 29q5-5 11 0t11 0" /></g>
      <path className="symbol-drop" d="M20 5c-7 8-4 12 0 12s7-4 0-12Z" />
    </>}
    {kind === 'cover' && <>
      <ellipse cx="20" cy="30" rx="14" ry="5" />
      <g className="symbol-lid"><path d="m6 19 25-9 4 5-25 9Z" /><path d="m13 17 3 4m5-7 3 4m4-6 3 4" /></g>
      <path d="m6 8 1 4m-4 2 3 1" />
    </>}
  </svg>
}
