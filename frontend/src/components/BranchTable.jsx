import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

function fmtRev(v) {
  if (!v && v !== 0) return '—'
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return Math.round(v).toLocaleString('ro-RO')
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-3 text-sm min-w-[180px]">
      <div className="font-semibold text-gray-700 mb-2 text-xs">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-3 py-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-semibold">{fmtRev(p.value)} RON</span>
        </div>
      ))}
    </div>
  )
}

export default function BranchTable({ data = [], loading, color = '#E8440A', title = 'Vânzări per Sucursală' }) {
  const [view, setView] = useState('chart') // 'chart' | 'table'

  const chartData = data.slice(0, 15).map(d => ({
    ...d,
    label: d.branch?.length > 18 ? d.branch.slice(0, 16) + '…' : d.branch,
  }))

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>
        <p className="text-sm text-gray-400 text-center py-8">
          Date per sucursală indisponibile — coloana "Zona" nu a fost detectată în fișierul Excel.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['chart', 'table'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                view === v ? 'bg-white shadow text-gray-800' : 'text-gray-500'
              }`}
            >
              {v === 'chart' ? '📊 Grafic' : '📋 Tabel'}
            </button>
          ))}
        </div>
      </div>

      {view === 'chart' ? (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={fmtRev}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              dataKey="label"
              type="category"
              width={130}
              tick={{ fontSize: 11, fill: '#374151' }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" name="Vânzări (RON)" fill={color} radius={[0, 4, 4, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="pb-2 font-semibold text-gray-500 text-xs">#</th>
                <th className="pb-2 font-semibold text-gray-500 text-xs">Sucursală / Zonă</th>
                <th className="pb-2 font-semibold text-gray-500 text-xs text-right">Vânzări (RON)</th>
                <th className="pb-2 font-semibold text-gray-500 text-xs text-right">PAX</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2 pr-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="py-2 font-medium text-gray-800">{row.branch}</td>
                  <td className="py-2 text-right font-semibold text-gray-900">
                    {fmtRev(row.revenue)} RON
                  </td>
                  <td className="py-2 text-right text-gray-500">
                    {row.bookings ? Math.round(row.bookings).toLocaleString('ro-RO') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
