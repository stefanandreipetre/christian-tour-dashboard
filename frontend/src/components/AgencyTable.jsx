import React, { useState } from 'react'
import clsx from 'clsx'

function fmt(v) {
  if (v === null || v === undefined) return '—'
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return Math.round(v).toLocaleString('ro-RO')
}

export default function AgencyTable({ data = [], loading }) {
  const [sortKey, setSortKey] = useState('revenue')
  const [sortAsc, setSortAsc] = useState(false)
  const [search, setSearch] = useState('')

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...data]
    .filter(a => !search || a.agency?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? -Infinity
      const bv = b[sortKey] ?? -Infinity
      return sortAsc ? av - bv : bv - av
    })

  const SortIcon = ({ k }) => (
    <span className={clsx('ml-1 text-xs', sortKey === k ? 'text-ct-orange' : 'text-gray-300')}>
      {sortKey === k ? (sortAsc ? '↑' : '↓') : '↕'}
    </span>
  )

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded mb-2" />
        ))}
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="font-semibold text-gray-800">Top Agenții B2B</h3>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Caută agenție…"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ct-orange/30 w-48"
        />
      </div>

      {sorted.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-sm">Nu există date disponibile</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium w-8">#</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Agenție</th>
                <th
                  className="text-right py-2 px-3 text-gray-500 font-medium cursor-pointer hover:text-ct-navy select-none whitespace-nowrap"
                  onClick={() => handleSort('revenue')}
                >
                  Vânzări <SortIcon k="revenue" />
                </th>
                <th
                  className="text-right py-2 px-3 text-gray-500 font-medium cursor-pointer hover:text-ct-navy select-none"
                  onClick={() => handleSort('plan')}
                >
                  Plan <SortIcon k="plan" />
                </th>
                <th
                  className="text-right py-2 px-3 text-gray-500 font-medium cursor-pointer hover:text-ct-navy select-none whitespace-nowrap"
                  onClick={() => handleSort('vs_plan_pct')}
                >
                  % Plan <SortIcon k="vs_plan_pct" />
                </th>
                <th
                  className="text-right py-2 px-3 text-gray-500 font-medium cursor-pointer hover:text-ct-navy select-none"
                  onClick={() => handleSort('bookings')}
                >
                  Rez. <SortIcon k="bookings" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const pct = row.vs_plan_pct
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-800">{row.agency || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{fmt(row.revenue)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-500">{fmt(row.plan)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {pct !== null && pct !== undefined ? (
                        <span className={clsx(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          pct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                        )}>
                          {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-600">{row.bookings ? Math.round(row.bookings) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
