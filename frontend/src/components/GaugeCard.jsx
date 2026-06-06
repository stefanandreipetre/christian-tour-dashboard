import React from 'react'
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts'

export default function GaugeCard({ title, actual, target, unit = 'RON', color = '#E8440A' }) {
  const pct = target ? Math.min(Math.round((actual / target) * 100), 150) : 0
  const data = [{ value: Math.min(pct, 100), fill: color }]

  function fmt(v) {
    if (v === null || v === undefined) return '—'
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`
    return Math.round(v).toLocaleString('ro-RO')
  }

  return (
    <div className="card flex flex-col items-center text-center">
      <h4 className="font-semibold text-gray-700 text-sm mb-2">{title}</h4>
      <div className="relative w-40 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="90%"
            innerRadius="70%" outerRadius="100%"
            startAngle={180} endAngle={0}
            data={data}
            barSize={14}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#f1f5f9' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-800">{fmt(actual)}</span>
        {' / '}
        <span>{fmt(target)} {unit}</span>
      </div>
    </div>
  )
}
