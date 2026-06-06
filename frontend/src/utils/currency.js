// All backend values are in RON. Display in EUR throughout the dashboard.
export const EUR_RATE = 5.0   // 1 EUR ≈ 5 RON (adjust here if rate changes)

export function toEur(ron) {
  if (ron == null || Number.isNaN(ron)) return null
  return ron / EUR_RATE
}

/** Compact axis label: "1.2M", "456K", "123" — no symbol */
export function fmtEurAxis(ron) {
  if (ron == null && ron !== 0) return ''
  const v = toEur(ron)
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return Math.round(v)
}

/** Full tooltip value: "€1.23M", "€456K", "€1,234" */
export function fmtEur(ron, compact = true) {
  if (ron == null || Number.isNaN(Number(ron))) return '—'
  const v = toEur(ron)
  if (compact) {
    if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`
    if (Math.abs(v) >= 1_000)     return `€${(v / 1_000).toFixed(1)}K`
    return `€${Math.round(v).toLocaleString('en')}`
  }
  return `€${Math.round(v).toLocaleString('en')}`
}
