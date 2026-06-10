import React from 'react'
import { fmtEur } from '../utils/currency'

export default function GaugeCard({ title, actual, target, color = '#E8440A' }) {
  const pct = target ? Math.min(Math.round((actual / target) * 100), 150) : 0
  const displayPct = Math.min(pct, 100)

  // Pure SVG half-circle gauge — no Recharts animation, always renders correctly
  const cx = 80, cy = 82, r = 58, sw = 14
  const bgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  let fillPath = null
  if (displayPct > 0) {
    if (displayPct >= 100) {
      fillPath = bgPath
    } else {
      const angleDeg = 180 - displayPct * 1.8
      const angleRad = (angleDeg * Math.PI) / 180
      const ex = (cx + r * Math.cos(angleRad)).toFixed(2)
      const ey = (cy - r * Math.sin(angleRad)).toFixed(2)
      fillPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}`
    }
  }

  return (
    <div className="card flex flex-col items-center text-center">
      <h4 className="font-semibold text-gray-700 text-sm mb-2">{title}</h4>
      <div className="relative" style={{ width: 160, height: 96 }}>
        <svg width="160" height="96" viewBox="0 0 160 96">
          <path d={bgPath} fill="none" stroke="#f1f5f9" strokeWidth={sw} strokeLinecap="round" />
          {fillPath && (
            <path d={fillPath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          )}
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-800">{fmtEur(actual)}</span>
        {' / '}
        <span>{fmtEur(target)}</span>
      </div>
    </div>
  )
}