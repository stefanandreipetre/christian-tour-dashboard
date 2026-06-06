import React from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area
} from 'recharts'

const COLORS = {
  revenue: '#E8440A',
  revenueLY: '#94a3b8',
  plan: '#1A2B5F',
  target: '#f59e0b',
}

function fmtY(v) {
  if (!v && v !== 0) return ''
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return v
}

function fmtTooltip(v) {
  if (!v && v !== 0) return '—'
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M RON`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K RON`
  return `${Math.round(v).toLocaleString('ro-RO')} RON`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-3 text-sm min-w-[180px]">
      <div className="font-semibold text-gray-700 mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-semibold text-gray-900">{fmtTooltip(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function RevenueChart({ data = [], title, showLY = true, showPlan = true, showTarget = false, height = 320 }) {
  const hasLY = showLY && data.some(d => d.revenueLY != null)
  const hasPlan = showPlan && data.some(d => d.plan != null)
  const hasTarget = showTarget && data.some(d => d.target != null)

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#E8440A" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#E8440A" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="monthName" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={55} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => <span className="text-gray-600">{value}</span>}
          />

          {hasLY && (
            <Bar dataKey="revenueLY" name="An anterior" fill={COLORS.revenueLY} radius={[3, 3, 0, 0]} maxBarSize={28} opacity={0.7} />
          )}

          <Bar dataKey="revenue" name="Vânzări actuale" fill={COLORS.revenue} radius={[4, 4, 0, 0]} maxBarSize={32} />

          {hasPlan && (
            <Line dataKey="plan" name="Plan" stroke={COLORS.plan} strokeWidth={2} dot={{ r: 3, fill: COLORS.plan }} strokeDasharray="5 3" />
          )}
          {hasTarget && (
            <Line dataKey="target" name="Target" stroke={COLORS.target} strokeWidth={2} dot={{ r: 3, fill: COLORS.target }} strokeDasharray="4 2" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
