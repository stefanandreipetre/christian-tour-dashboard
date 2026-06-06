import React from 'react'
import CTLogo from './CTLogo'
import { triggerRefresh } from '../api'

const MONTHS = ['', 'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Header({ year, setYear, month, setMonth, lastUpdated, onRefresh }) {
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear].filter(y => y >= 2023)

  const handleRefresh = async () => {
    try {
      await triggerRefresh()
      setTimeout(() => onRefresh?.(), 3000)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <header className="bg-ct-navy text-white shadow-xl sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-6 flex-wrap">
        {/* Logo + title */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <CTLogo size={44} />
          <div>
            <div className="font-black text-lg leading-tight tracking-wide">Christian Tour</div>
            <div className="text-xs text-blue-200 leading-tight font-medium">Sales Dashboard</div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-blue-200 font-medium">An</label>
            <select
              value={year || ''}
              onChange={e => setYear(e.target.value ? parseInt(e.target.value) : null)}
              className="bg-ct-navy-light border border-blue-400 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ct-orange"
            >
              <option value="">Toți anii</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-blue-200 font-medium">Lună</label>
            <select
              value={month || ''}
              onChange={e => setMonth(e.target.value ? parseInt(e.target.value) : null)}
              className="bg-ct-navy-light border border-blue-400 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ct-orange"
            >
              <option value="">Toate lunile</option>
              {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>

          {lastUpdated && (
            <div className="text-xs text-blue-300 hidden lg:block">
              Actualizat: {new Date(lastUpdated * 1000).toLocaleString('ro-RO', {
                hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
              })}
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="bg-ct-orange hover:bg-ct-orange-dark text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </header>
  )
}
