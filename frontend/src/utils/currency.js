// Backend values are already in EUR — no conversion needed.

export function fmtEurAxis(eur) {
  if (eur == null) return ''
  const v = Number(eur)
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return Math.round(v)
}

export function fmtEur(eur, compact = true) {
  if (eur == null || Number.isNaN(Number(eur))) return '—'
  const v = Number(eur)
  if (compact) {
    if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`
    if (Math.abs(v) >= 1_000)     return `€${(v / 1_000).toFixed(1)}K`
    return `€${Math.round(v).toLocaleString('en')}`
  }
  return `€${Math.round(v).toLocaleString('en')}`
}

// Kept for any legacy callers; no-op since values are already EUR
export const EUR_RATE = 1.0
export function toEur(v) { return v }
