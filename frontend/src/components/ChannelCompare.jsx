import React from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function fmt(v) {
  if (v === null || v === undefined) return '—'
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M RON`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K RON`
  return `${Math.round(v).toLocaleString('ro-RO')} RON`
}

const COLORS = ['#E8440A', '#1A2B5F']

export default function ChannelCompare({ b2bRevenue, b2cRevenue }) {
  const total = (b2bRevenue || 0) + (b2cRevenue || 0)
  if (!total) return null

  const data = [
    { name: 'B2B', value: b2bRevenue || 0 },
    { name: 'B2C / Site', value: b2cRevenue || 0 },
  ]

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>
        {(percent * 100).toFixed(0)}%
      </text>
    )
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800 mb-4">Split Canal</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            outerRadius={90}
            innerRadius={45}
            dataKey="value"
            labelLine={false}
            label={<CustomLabel />}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => fmt(v)} />
          <Legend
            formatter={(value, entry) => (
              <span className="text-sm text-gray-600">
                {value} — <strong>{fmt(entry.payload.value)}</strong>
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
