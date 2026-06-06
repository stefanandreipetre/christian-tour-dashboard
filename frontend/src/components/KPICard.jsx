import React from 'react'
import clsx from 'clsx'

function formatNum(val, type = 'currency') {
  if (val === null || val === undefined) return '—'
  if (type === 'pct') return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`
  if (type === 'int') return Math.round(val).toLocaleString('ro-RO')
  // currency — auto-scale
  if (Math.abs(val) >= 1_000_000)
    return `${(val / 1_000_000).toFixed(2)}M RON`
  if (Math.abs(val) >= 1_000)
    return `${(val / 1_000).toFixed(1)}K RON`
  return `${Math.round(val).toLocaleString('ro-RO')} RON`
}

export default function KPICard({ title, value, valueType, delta, deltaLabel, icon, color = 'orange', loading }) {
  const colorMap = {
    orange: { bg: 'bg-ct-orange', text: 'text-ct-orange', light: 'bg-orange-50' },
    navy:   { bg: 'bg-ct-navy',   text: 'text-ct-navy',   light: 'bg-blue-50'   },
    green:  { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' },
    purple: { bg: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-50'  },
  }
  const c = colorMap[color] || colorMap.orange

  const positive = delta > 0
  const negative = delta < 0

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    )
  }

  return (
    <div className="card flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0', c.bg)}>
          {icon}
        </div>
        {delta !== null && delta !== undefined && (
          <div
            className={clsx(
              'text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1',
              positive ? 'bg-emerald-100 text-emerald-700' :
              negative ? 'bg-red-100 text-red-600' :
              'bg-gray-100 text-gray-500'
            )}
          >
            {positive ? '▲' : negative ? '▼' : '→'}
            {formatNum(delta, 'pct')}
          </div>
        )}
      </div>

      <div>
        <div className="text-2xl font-bold text-gray-900 tracking-tight">
          {formatNum(value, valueType)}
        </div>
        <div className="text-sm text-ct-gray-dark font-medium mt-0.5">{title}</div>
      </div>

      {deltaLabel && (
        <div className="text-xs text-gray-400 border-t border-gray-50 pt-2">{deltaLabel}</div>
      )}
    </div>
  )
}
