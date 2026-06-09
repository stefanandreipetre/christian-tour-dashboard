import React, { useState } from 'react'
import clsx from 'clsx'
import { fmtEur } from '../utils/currency'

export default function AgencyTable({ data = [], loading, mode = 'plan' }) {
  const [sortKey, setSortKey] = useState('revenue')
  const [sortAsc, setSortAsc] = useState(false)
  const [search,  setSearch]  = useState('')

  const handleSort = k => { if (sortKey === k) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(false) } }

  const sorted = [...data]
    .filter(a => !search || a.agency?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? -Infinity, bv = b[sortKey] ?? -Infinity
      return sortAsc ? av - bv : bv - av
    })

  const SortIcon = ({ k }) => (
    <span className={clsx('ml-1 text-xs', sortKey === k ? 'text-ct-orange' : 'text-gray-300')}>
      {sortKey === k ? (sortAsc ? '↑' : '↓') : '↕'}
    </span>
  )
  const Th = ({ label, k }) => (
    <th onClick={() => handleSort(k)}
      className="text-right py-2 px-3 text-gray-500 font-medium text-xs cursor-pointer hover:text-ct-navy select-none whitespace-nowrap">
      {label}<SortIcon k={k} />
    </th>
  )

  if (loading) return (
    <div className="card animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
      {[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded mb-2" />)}
    </div>
  )

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="font-semibold text-gray-800">Top Agentii B2B</h3>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cauta agentie..." className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ct-orange/30 w-48" />
      </div>

      {sorted.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-sm">Nu exista date disponibile</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs w-8">#</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Agentie</th>
                <Th label="Vanzari" k="revenue" />
                {mode === 'ly' ? (
                  <>
                    <Th label="An anterior" k="ly" />
                    <Th label="% vs 2025" k="vs_ly_pct" />
                  </>
                ) : (
                  <>
                    <Th label="Plan" k="plan" />
                    <Th label="% Plan" k="vs_plan_pct" />
                  </>
                )}
                <Th label="PAX" k="pax" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const pct = mode === 'ly' ? row.vs_ly_pct : row.vs_plan_pct
                const pos = pct >= 0
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-800">{row.agency || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{fmtEur(row.revenue)}</td>
                    {mode === 'ly' ? (
                      <td className="py-2.5 px-3 text-right text-gray-500">{fmtEur(row.ly)}</td>
                    ) : (
                      <td className="py-2.5 px-3 text-right text-gray-500">{fmtEur(row.plan)}</td>
                    )}
                    <td className="py-2.5 px-3 text-right">
                      {pct != null ? (
                        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full',
                          pos ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600')}>
                          {pos ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-600">{row.pax ? row.pax.toLocaleString('en') : '—'}</td>
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
