import React from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { fmtEur, fmtEurAxis } from '../utils/currency'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-3 text-sm min-w-[180px]">
      <div className="font-semibold text-gray-700 mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-semibold text-gray-900">{fmtEur(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DailyChart({ data = [], title = 'B2C — Zilnic vs An Anterior', days = 30, onDaysChange, loading }) {
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
          Date zilnice indisponibile — câmpul "date" nu a fost detectat în fișierul Excel.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {onDaysChange && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[14, 30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => onDaysChange(d)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  days === d ? 'bg-white shadow text-ct-navy' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {d}z
              </button>
            ))}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false} tickLine={false}
            interval={Math.floor(data.length / 10)}
          />
          <YAxis
            tickFormatter={fmtEurAxis}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false} tickLine={false}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          <Bar dataKey="revenueLY" name="An anterior" fill="#94a3b8" radius={[2, 2, 0, 0]} maxBarSize={14} opacity={0.7} />
          <Bar dataKey="revenue" name="Vânzări actuale" fill="#E8440A" radius={[2, 2, 0, 0]} maxBarSize={14} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
