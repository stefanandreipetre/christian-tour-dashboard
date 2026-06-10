import React, { useState, useEffect, useCallback } from 'react'
import Header       from './components/Header'
import KPICard      from './components/KPICard'
import RevenueChart from './components/RevenueChart'
import AgencyTable  from './components/AgencyTable'
import GaugeCard    from './components/GaugeCard'
import StatusBanner from './components/StatusBanner'
import { fmtEur } from './utils/currency'
import {
  getStatus,
  getB2BSummary, getB2BAgencies,
  getB2CSummary, getB2CBranches,
} from './api'

const TABS = [
  { id: 'overview', label: 'Overview'   },
  { id: 'b2b',      label: 'B2B'        },
  { id: 'b2c',      label: 'B2C / Site' },
]

const MN = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec']

function MonthSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 font-medium">YTD pana in:</span>
      <select value={value} onChange={e => onChange(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-ct-orange/30">
        {MN.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
      </select>
    </div>
  )
}

function aggregateSummary(rows, maxMonth = 12) {
  if (!Array.isArray(rows) || !rows.length) return null
  const filtered = rows.filter(r => r.month >= 1 && r.month <= maxMonth)
  if (!filtered.length) return null
  const agg = filtered.reduce(
    (acc, r) => ({
      revenue: acc.revenue + (r.revenue || 0),
      plan:    acc.plan    + (r.plan    || 0),
      ly:      acc.ly      + (r.ly      || 0),
      pax:     acc.pax     + (r.pax     || 0),
    }),
    { revenue: 0, plan: 0, ly: 0, pax: 0 }
  )
  agg.bookings    = agg.pax
  agg.vs_ly_pct   = agg.ly   ? +((agg.revenue / agg.ly   - 1) * 100).toFixed(1) : null
  agg.vs_plan_pct = agg.plan ? +((agg.revenue / agg.plan)     * 100).toFixed(1) : null
  return agg
}

function toChartRows(rows, maxMonth = 12) {
  if (!Array.isArray(rows)) return []
  return rows
    .filter(r => r.month >= 1 && r.month <= maxMonth)
    .sort((a, b) => a.month - b.month)
    .map(r => ({ ...r, monthName: MN[r.month - 1], revenueLY: r.ly || null }))
}

function pctBadge(val) {
  if (val == null) return null
  const pos = val >= 0
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pos ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
      {pos ? '+' : ''}{val.toFixed(1)}%
    </span>
  )
}

function BranchForecastTable({ data = [], loading }) {
  const [sortKey, setSortKey] = useState('revenue')
  const [sortAsc, setSortAsc] = useState(false)
  const [search, setSearch] = useState('')

  const sorted = [...data]
    .filter(r => !search || r.branch?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? -Infinity
      const bv = b[sortKey] ?? -Infinity
      return sortAsc ? av - bv : bv - av
    })

  const Th = ({ label, k }) => (
    <th onClick={() => { if (sortKey === k) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(false) } }}
      className="text-right py-2 px-3 text-gray-500 font-medium text-xs cursor-pointer hover:text-ct-navy select-none whitespace-nowrap">
      {label} {sortKey === k ? (sortAsc ? '\u2191' : '\u2193') : '\u2195'}
    </th>
  )

  if (loading) return <div className="card animate-pulse h-64" />

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="font-semibold text-gray-800">Outlook Sucursale B2C</h3>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cauta sucursala..." className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ct-orange/30 w-44" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs w-8">#</th>
              <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Sucursala</th>
              <Th label="Actual 2026" k="revenue" />
              <Th label="Actual 2025" k="ly" />
              <Th label="Plan 2026" k="plan" />
              <Th label="% vs Plan" k="vs_plan_pct" />
              <Th label="% vs 2025" k="vs_ly_pct" />
              <Th label="PAX" k="pax" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const vsLy = row.ly ? +((row.revenue / row.ly - 1) * 100).toFixed(1) : null
              return (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2 px-3 text-gray-400 text-xs">{i+1}</td>
                  <td className="py-2 px-3 font-medium text-gray-800">{row.branch || '\u2014'}</td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-900">{fmtEur(row.revenue)}</td>
                  <td className="py-2 px-3 text-right text-gray-500">{fmtEur(row.ly)}</td>
                  <td className="py-2 px-3 text-right text-gray-500">{fmtEur(row.plan)}</td>
                  <td className="py-2 px-3 text-right">{pctBadge(row.vs_plan_pct)}</td>
                  <td className="py-2 px-3 text-right">{pctBadge(vsLy)}</td>
                  <td className="py-2 px-3 text-right text-gray-600">{row.pax ? row.pax.toLocaleString('en') : '\u2014'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function App() {
  const currentMonth = new Date().getMonth() + 1
  const [tab,         setTab]         = useState('overview')
  const [year,        setYear]        = useState(new Date().getFullYear())
  const [ytdMonth,    setYtdMonth]    = useState(currentMonth)

  const [status,         setStatus]         = useState(null)
  const [b2bSummaryData, setB2bSummaryData] = useState(null)
  const [b2bSumLYData,   setB2bSumLYData]   = useState(null)
  const [b2cSummaryData, setB2cSummaryData] = useState(null)
  const [agencies,       setAgencies]       = useState([])
  const [agenciesLY,     setAgenciesLY]     = useState([])
  const [b2cBranches,    setB2cBranches]    = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [st, b2bSum, b2cSum, b2bSumLY, ag, agLY, b2cBr] = await Promise.allSettled([
        getStatus(),
        getB2BSummary(year),
        getB2CSummary(year),
        getB2BSummary(year - 1),
        getB2BAgencies(year, ytdMonth),
        getB2BAgencies(year - 1, ytdMonth),
        getB2CBranches(year, ytdMonth),
      ])
      if (st.status       === 'fulfilled') setStatus(st.value)
      if (b2bSum.status   === 'fulfilled') setB2bSummaryData(b2bSum.value)
      if (b2cSum.status   === 'fulfilled') setB2cSummaryData(b2cSum.value)
      if (b2bSumLY.status === 'fulfilled') setB2bSumLYData(b2bSumLY.value)
      if (ag.status       === 'fulfilled') setAgencies(ag.value)
      if (agLY.status     === 'fulfilled') setAgenciesLY(agLY.value)
      if (b2cBr.status    === 'fulfilled') setB2cBranches(b2cBr.value)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [year, ytdMonth])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const id = setInterval(fetchAll, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchAll])

  const lastUpdated = status
    ? Math.max(status.b2c?.updated_at || 0, status.b2b?.updated_at || 0)
    : null

  const b2bSummary = aggregateSummary(b2bSummaryData, ytdMonth)
  const b2cSummary = aggregateSummary(b2cSummaryData, ytdMonth)

  const combinedRevenue   = (b2bSummary?.revenue || 0) + (b2cSummary?.revenue || 0)
  const combinedPlan      = (b2bSummary?.plan    || 0) + (b2cSummary?.plan    || 0)
  const combinedPAX       = (b2bSummary?.pax     || 0) + (b2cSummary?.pax     || 0)
  const combinedVsPlanPct = combinedPlan ? +((combinedRevenue / combinedPlan) * 100).toFixed(1) : null
  const ytdLabel = `Ian - ${MN[ytdMonth - 1]} ${year}`

  const b2cChartRows = toChartRows(b2cSummaryData, ytdMonth)

  const b2bSumLYMap = {}
  if (Array.isArray(b2bSumLYData)) {
    b2bSumLYData.forEach(r => { if (r.month) b2bSumLYMap[r.month] = r.revenue || 0 })
  }
  const b2bChartRows = toChartRows(b2bSummaryData, ytdMonth).map(r => ({
    ...r,
    revenueLY: b2bSumLYMap[r.month] != null ? b2bSumLYMap[r.month] : (r.revenueLY ?? null),
  }))

  const combinedChartRows = b2cChartRows.map(r => {
    const b2b = b2bChartRows.find(x => x.month === r.month) || {}
    return {
      ...r,
      revenue:   (r.revenue   || 0) + (b2b.revenue   || 0),
      plan:      (r.plan      || 0) + (b2b.plan      || 0),
      revenueLY: (r.revenueLY || 0) + (b2b.revenueLY || 0),
    }
  })

  const agenciesWithLY = agencies.map(a => {
    const ly = agenciesLY.find(x => x.agency === a.agency)
    const lyRev = ly?.revenue ?? null
    const vs_ly_pct = (lyRev && a.revenue) ? +((a.revenue / lyRev - 1) * 100).toFixed(1) : null
    return { ...a, ly: lyRev, vs_ly_pct }
  })

  return (
    <div className="min-h-screen bg-ct-gray">
      <Header year={year} setYear={setYear} lastUpdated={lastUpdated} onRefresh={fetchAll} />
      <StatusBanner status={status} />

      <div className="max-w-screen-2xl mx-auto px-6 mt-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id ? 'bg-ct-navy text-white shadow-sm' : 'text-gray-500 hover:text-ct-navy hover:bg-gray-50'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <MonthSelector value={ytdMonth} onChange={setYtdMonth} />
      </div>

      <main className="max-w-screen-2xl mx-auto px-6 pb-12 mt-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            Eroare API: {error}
          </div>
        )}

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Plan YTD (B2B+B2C)" value={combinedPlan}
                deltaLabel={ytdLabel} icon="\ud83d\udccb" color="navy" loading={loading} />
              <KPICard title="Actual YTD (B2B+B2C)" value={combinedRevenue}
                delta={b2cSummary?.vs_ly_pct} deltaLabel={`vs ${year - 1}`}
                icon="\ud83c\udf10" color="orange" loading={loading} />
              <KPICard title="PAX Total (B2B+B2C)" value={combinedPAX}
                valueType="int" icon="\ud83c\udfab" color="green" loading={loading} />
              <KPICard title="% Realizare Plan" value={combinedVsPlanPct}
                valueType="pct" deltaLabel={ytdLabel}
                icon="\ud83c\udfaf" color="purple" loading={loading} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <RevenueChart
                  data={combinedChartRows}
                  title={`Total B2B+B2C \u2014 Actual ${year} vs ${year-1} vs Plan`}
                  showLY showPlan
                  revenueLabel={`Actual ${year} (B2B+B2C)`}
                  lyLabel={`Actual ${year-1} (B2B+B2C)`}
                  height={360}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <GaugeCard title="% Realizare Plan TOTAL"
                  actual={combinedRevenue} target={combinedPlan} color="#E8440A" />
                <GaugeCard title="% Realizare Plan B2C"
                  actual={b2cSummary?.revenue} target={b2cSummary?.plan} color="#1A2B5F" />
                <GaugeCard title="% Realizare Plan B2B"
                  actual={b2bSummary?.revenue} target={b2bSummary?.plan} color="#10b981" />
              </div>
            </div>
          </>
        )}

        {tab === 'b2b' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Plan B2B YTD" value={b2bSummary?.plan}
                deltaLabel={ytdLabel} icon="\ud83d\udccb" color="navy" loading={loading} />
              <KPICard title="Actual B2B YTD" value={b2bSummary?.revenue}
                delta={b2bSummary?.vs_ly_pct} deltaLabel={`vs ${year-1}`}
                icon="\ud83d\udcbc" color="orange" loading={loading} />
              <KPICard title="PAX B2B" value={b2bSummary?.pax}
                valueType="int" icon="\ud83c\udfab" color="green" loading={loading} />
              <KPICard title="% Realizare Plan B2B" value={b2bSummary?.vs_plan_pct}
                valueType="pct" deltaLabel={ytdLabel}
                icon="\ud83c\udfaf" color="purple" loading={loading} />
            </div>

            <RevenueChart
              data={b2bChartRows}
              title={`B2B \u2014 Actual ${year} vs ${year-1} vs Plan`}
              showLY showPlan
              revenueLabel={`Actual ${year}`}
              lyLabel={`Actual ${year-1}`}
              height={360}
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <AgencyTable data={agenciesWithLY} loading={loading} mode="ly" />
              </div>
              <GaugeCard title="% Realizare Plan B2B"
                actual={b2bSummary?.revenue} target={b2bSummary?.plan} color="#E8440A" />
            </div>
          </>
        )}

        {tab === 'b2c' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Plan B2C YTD" value={b2cSummary?.plan}
                deltaLabel={ytdLabel} icon="\ud83d\udccb" color="navy" loading={loading} />
              <KPICard title="Actual B2C YTD" value={b2cSummary?.revenue}
                delta={b2cSummary?.vs_ly_pct} deltaLabel={`vs ${year-1}`}
                icon="\ud83c\udf10" color="orange" loading={loading} />
              <KPICard title="PAX B2C" value={b2cSummary?.pax}
                valueType="int" icon="\ud83c\udfab" color="green" loading={loading} />
              <KPICard title="% Realizare Plan B2C" value={b2cSummary?.vs_plan_pct}
                valueType="pct" deltaLabel={ytdLabel}
                icon="\ud83c\udfaf" color="purple" loading={loading} />
            </div>

            <RevenueChart
              data={b2cChartRows}
              title={`B2C / Site \u2014 Actual ${year} vs ${year-1} vs Plan`}
              showLY showPlan
              revenueLabel={`Actual ${year}`}
              lyLabel={`Actual ${year-1}`}
              height={360}
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <BranchForecastTable data={b2cBranches} loading={loading} />
              </div>
              <GaugeCard title="% Realizare Plan B2C"
                actual={b2cSummary?.revenue} target={b2cSummary?.plan} color="#1A2B5F" />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white mt-8 py-4">
        <div className="max-w-screen-2xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
          <span>\u00a9 {new Date().getFullYear()} Christian Tour \u2014 Sales Dashboard</span>
          <span>Date actualizate automat la fiecare ora din SharePoint</span>
        </div>
      </footer>
    </div>
  )
}