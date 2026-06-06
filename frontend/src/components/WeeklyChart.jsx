import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import { fmtEur, fmtEurAxis } from '../utils/currency'

const COLOR_CURRENT = '#E8440A'
const COLOR_NORMAL  = '#f97316'
const COLOR_LY      = '#94a3b8'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-3 text-sm min-w-[180px]">
      <div className="font-semibold text-gray-700 mb-1">
        {entry?.weekYear}
        {entry?.isCurrent && <span className="ml-2 text-xs bg-ct-orange text-white px-1.5 py-0.5 rounded-full">săpt. curentă</span>}
      </div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-semibold text-gray-900">{fmtEur(p.value)}</span>
        </div>
      ))}
      {entry?.revenue != null && entry?.revenueLY != null && (
        <div className="border-t border-gray-100 mt-1 pt-1 text-xs text-gray-500">
          {(() => {
            const diff = ((entry.revenue - entry.revenueLY) / entry.revenueLY * 100)
            return (
              <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% vs AN
              </span>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default function WeeklyChart({ data = [], title = 'B2C — Evoluție Săptămânală', loading }) {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-56 bg-gray-100 rounded" />
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>
        <p className="text-sm text-gray-400 text-center py-8">
          Date săptămânale indisponibile — câmpul "date" nu a fost detectat în fișierul Excel.
        </p>
      </div>
    )
  }

  // Summary row for current week vs same week LY
  const cur = data.find(d => d.isCurrent)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {cur && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">Săpt. curentă ({cur.weekYear}):</span>
            <span className="font-bold text-ct-orange">{fmtEur(cur.revenue)}</span>
            {cur.revenueLY != null && (
              <span className={`font-semibold px-2 py-0.5 rounded-full ${
                cur.revenue >= cur.revenueLY ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}>
                {cur.revenue >= cur.revenueLY ? '▲' : '▼'}
                {' '}{Math.abs((cur.revenue - cur.revenueLY) / cur.revenueLY * 100).toFixed(1)}% vs AN
              </span>
            )}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="weekYear"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false} tickLine={false}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={40}
          />
          <YAxis
            tickFormatter={fmtEurAxis}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false} tickLine={false}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          <Bar dataKey="revenueLY" name="An anterior" fill={COLOR_LY} radius={[2, 2, 0, 0]} maxBarSize={18} opacity={0.7} />
          <Bar dataKey="revenue" name="Vânzări actuale" radius={[3, 3, 0, 0]} maxBarSize={18}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isCurrent ? COLOR_CURRENT : COLOR_NORMAL}
                opacity={entry.isCurrent ? 1 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
