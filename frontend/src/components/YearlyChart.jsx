import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts'

function fmtY(v) {
  if (!v && v !== 0) return ''
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return v
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-3 text-sm min-w-[160px]">
      <div className="font-bold text-gray-800 mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-semibold">{fmtY(p.value)} RON</span>
        </div>
      ))}
    </div>
  )
}

export default function YearlyChart({ b2bData = [], b2cData = [], loading, height = 320 }) {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    )
  }

  // Merge b2b + b2c by year
  const years = [...new Set([...b2bData.map(d => d.year), ...b2cData.map(d => d.year)])].sort()
  const combined = years.map(y => {
    const b = b2bData.find(d => d.year === y)
    const c = b2cData.find(d => d.year === y)
    return { year: String(y), b2b: b?.revenue || null, b2c: c?.revenue || null }
  })

  if (!combined.length) {
    return (
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Tendință Multi-An</h3>
        <p className="text-sm text-gray-400 text-center py-8">Date indisponibile</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800 mb-4">Tendință Multi-An — B2B & B2C</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={combined} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 13, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={55} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          <Bar dataKey="b2b" name="B2B" fill="#E8440A" radius={[5, 5, 0, 0]} maxBarSize={50}>
            <LabelList dataKey="b2b" position="top" formatter={fmtY} style={{ fontSize: 10, fill: '#E8440A', fontWeight: 600 }} />
          </Bar>
          <Bar dataKey="b2c" name="B2C / Site" fill="#1A2B5F" radius={[5, 5, 0, 0]} maxBarSize={50}>
            <LabelList dataKey="b2c" position="top" formatter={fmtY} style={{ fontSize: 10, fill: '#1A2B5F', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
