import React, { useState, useEffect, useCallback } from 'react'
import Header      from './components/Header'
import KPICard     from './components/KPICard'
import RevenueChart from './components/RevenueChart'
import AgencyTable  from './components/AgencyTable'
import GaugeCard    from './components/GaugeCard'
import ChannelCompare from './components/ChannelCompare'
import StatusBanner   from './components/StatusBanner'
import BranchTable    from './components/BranchTable'
import YearlyChart    from './components/YearlyChart'
import DailyChart     from './components/DailyChart'
import WeeklyChart    from './components/WeeklyChart'
import { fmtEur } from './utils/currency'
import {
  getStatus, getOverview,
  getB2BSummary, getB2BMonthly, getB2BYearly, getB2BRecent, getB2BAgencies, getB2BvsTarget, getB2BBranches,
  getB2CSummary, getB2CMonthly, getB2CYearly, getB2CRecent, getB2CBranches, getB2CDaily, getB2CWeekly,
  getOutlookMonthly,
} from './api'

const TABS = [
  { id: 'overview',  label: 'Overview'       },
  { id: 'b2b',       label: 'B2B'            },
  { id: 'b2c',       label: 'B2C / Site'     },
  { id: 'branches',  label: 'Sucursale'      },
  { id: 'yearly',    label: 'Multi-An'       },
]

const PERIODS = [
  { id: 'recent',  label: 'Recente'  },
  { id: 'monthly', label: 'Lunar'    },
  { id: 'yearly',  label: 'Anual'    },
]

const B2C_PERIODS = [
  { id: 'recent',  label: 'Recente'  },
  { id: 'monthly', label: 'Lunar'    },
  { id: 'daily',   label: 'Zilnic'   },
  { id: 'weekly',  label: 'Săptămânal' },
  { id: 'yearly',  label: 'Anual'    },
]

function PeriodToggle({ value, onChange, options = PERIODS }) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
      {options.map(p => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            value === p.id ? 'bg-white shadow text-ct-navy' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

// Fold a monthly-records array into a single summary object for KPICard / GaugeCard
function aggregateSummary(rows) {
  if (!Array.isArray(rows) || !rows.length) return null
  const agg = rows.reduce(
    (acc, r) => ({
      revenue:      acc.revenue      + (r.revenue      || 0),
      plan:         acc.plan         + (r.plan         || 0),
      ly:           acc.ly           + (r.ly           || 0),
      pax:          acc.pax          + (r.pax          || 0),
      reservations: acc.reservations + (r.reservations || 0),
    }),
    { revenue: 0, plan: 0, ly: 0, pax: 0, reservations: 0 }
  )
  agg.bookings     = agg.pax
  agg.vs_ly_pct    = agg.ly   ? +((agg.revenue / agg.ly   - 1) * 100).toFixed(1) : null
  agg.vs_plan_pct  = agg.plan ? +((agg.revenue / agg.plan)     * 100).toFixed(1) : null
  return agg
}


const MONTH_NAMES = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec']

// Convert /api/b2c(b2b)/summary rows → chart-ready rows with monthName & revenueLY
function toChartRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .filter(r => r.month >= 1 && r.month <= 12)
    .sort((a, b) => a.month - b.month)
    .map(r => ({ ...r, monthName: MONTH_NAMES[r.month - 1], revenueLY: r.ly || null }))
}

export default function App() {
  const [tab, setTab]             = useState('overview')
  const [period, setPeriod]       = useState('monthly')
  const [year, setYear]           = useState(new Date().getFullYear())
  const [month, setMonth]         = useState(null)
  const [compareYear, setCompareYear] = useState(new Date().getFullYear() - 1)

  const [status, setStatus]             = useState(null)
  const [overview, setOverview]         = useState(null)
  const [b2bSummaryData, setB2bSummaryData] = useState(null)
  const [b2cSummaryData, setB2cSummaryData] = useState(null)
  const [b2bMonthly, setB2bMonthly]     = useState([])
  const [b2bRecent, setB2bRecent]       = useState([])
  const [b2bYearly, setB2bYearly]       = useState([])
  const [b2cMonthly, setB2cMonthly]     = useState([])
  const [b2cRecent, setB2cRecent]       = useState([])
  const [b2cYearly, setB2cYearly]       = useState([])
  const [agencies, setAgencies]         = useState([])
  const [b2bVsTarget, setB2bVsTarget]   = useState(null)
  const [b2bBranches, setB2bBranches]   = useState([])
  const [b2cBranches, setB2cBranches]   = useState([])
  const [b2cDaily, setB2cDaily]         = useState([])
  const [b2cWeekly, setB2cWeekly]       = useState([])
  const [b2cDays, setB2cDays]           = useState(30)
  const [outlookMonthly, setOutlookMonthly] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.allSettled([
        getStatus(),
        getOverview(year),
        getB2BSummary(year, month),
        getB2CSummary(year, month),
        getB2BMonthly(year),
        getB2BRecent(8),
        getB2BYearly(),
        getB2CMonthly(year),
        getB2CRecent(8),
        getB2CYearly(),
        getB2BAgencies(year, month, 30),
        getB2BvsTarget(year, month),
        getB2BBranches(year, month),
        getB2CBranches(year, month),
        getOutlookMonthly(year),
        getB2CDaily(b2cDays),
        getB2CWeekly(null, 16),
      ])

      const [st, ov, b2bSum, b2cSum, b2bM, b2bR, b2bY, b2cM, b2cR, b2cY, ag, bvt, b2bBr, b2cBr, outM, b2cD, b2cW] = results

      if (st.status    === 'fulfilled') setStatus(st.value)
      if (ov.status    === 'fulfilled') setOverview(ov.value)
      if (b2bSum.status === 'fulfilled') setB2bSummaryData(b2bSum.value)
      if (b2cSum.status === 'fulfilled') setB2cSummaryData(b2cSum.value)
      if (b2bM.status  === 'fulfilled') setB2bMonthly(b2bM.value)
      if (b2bR.status  === 'fulfilled') setB2bRecent(b2bR.value)
      if (b2bY.status  === 'fulfilled') setB2bYearly(b2bY.value)
      if (b2cM.status  === 'fulfilled') setB2cMonthly(b2cM.value)
      if (b2cR.status  === 'fulfilled') setB2cRecent(b2cR.value)
      if (b2cY.status  === 'fulfilled') setB2cYearly(b2cY.value)
      if (ag.status    === 'fulfilled') setAgencies(ag.value)
      if (bvt.status   === 'fulfilled') setB2bVsTarget(bvt.value)
      if (b2bBr.status === 'fulfilled') setB2bBranches(b2bBr.value)
      if (b2cBr.status === 'fulfilled') setB2cBranches(b2cBr.value)
      if (outM.status  === 'fulfilled') setOutlookMonthly(outM.value)
      if (b2cD.status  === 'fulfilled') setB2cDaily(b2cD.value)
      if (b2cW.status  === 'fulfilled') setB2cWeekly(b2cW.value)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [year, month, compareYear, b2cDays])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const id = setInterval(fetchAll, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchAll])

  const b2bSummary = aggregateSummary(b2bSummaryData) ?? overview?.b2b?.summary
  const b2cSummary = aggregateSummary(b2cSummaryData) ?? overview?.b2c?.summary
  const lastUpdated = status
    ? Math.max(status.b2c?.updated_at || 0, status.b2b?.updated_at || 0)
    : null

  // Combined totals (B2B EUR actuals unavailable — only PAX from B2B Daily)
  const combinedPlan      = (b2cSummary?.plan    || 0) + (b2bSummary?.plan || 0)
  const combinedRevenue   = (b2cSummary?.revenue || 0)  // B2B has no EUR actuals
  const combinedPAX       = (b2cSummary?.pax     || 0) + (b2bSummary?.pax  || 0)
  const combinedVsPlanPct = combinedPlan ? +((combinedRevenue / combinedPlan) * 100).toFixed(1) : null

  // Chart rows from monthly-aggregated summaries (12 rows, not per-branch records)
  const b2cChartRows = toChartRows(b2cSummaryData)
  const b2bChartRows = toChartRows(b2bSummaryData).map(r => ({ ...r, revenue: null }))
  // Combined chart: B2C actuals + LY, plan = B2C + B2B merged by month
  const combinedChartRows = b2cChartRows.map(r => {
    const b2b = b2bChartRows.find(x => x.month === r.month) || {}
    return { ...r, plan: (r.plan || 0) + (b2b.plan || 0) }
  })
  const activeSlice = rows => rows.filter(r => (r.revenue || 0) > 0 || (r.plan || 0) > 0).slice(-8)
  const b2cChartData     = period === 'recent' ? activeSlice(b2cChartRows)      : b2cChartRows
  const b2bChartData     = period === 'recent' ? activeSlice(b2bChartRows)      : b2bChartRows
  const overviewChartData = period === 'recent' ? activeSlice(combinedChartRows) : combinedChartRows

  const overviewChartTitle = period === 'recent'
    ? `Total B2B+B2C — Ultimele 8 Luni`
    : `Total B2B+B2C — Plan vs Actuale B2C (${year})`
  const b2cTabChartTitle = period === 'recent'
    ? 'B2C / Site — Ultimele 8 Luni'
    : `B2C / Site — Actuale vs An Anterior vs Plan (${year})`
  const b2bTabChartTitle = period === 'recent'
    ? 'B2B — Plan Lunar (Actuale EUR indisponibile)'
    : `B2B — Plan Lunar ${year} (Actuale EUR indisponibile)`

  return (
    <div className="min-h-screen bg-ct-gray">
      <Header
        year={year} setYear={setYear}
        month={month} setMonth={setMonth}
        lastUpdated={lastUpdated}
        onRefresh={fetchAll}
      />

      <StatusBanner status={status} />

      {/* Tab bar */}
      <div className="max-w-screen-2xl mx-auto px-6 mt-6">
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-ct-navy text-white shadow-sm'
                  : 'text-gray-500 hover:text-ct-navy hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-screen-2xl mx-auto px-6 pb-12 mt-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            Eroare API: {error}
          </div>
        )}

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Plan Total (B2B+B2C)" value={combinedPlan}
                deltaLabel="Target anual cumulat"
                icon="📋" color="navy" loading={loading} />
              <KPICard title="Actual YTD (B2C)" value={combinedRevenue}
                delta={b2cSummary?.vs_ly_pct} deltaLabel={`vs ${compareYear}`}
                icon="🌐" color="orange" loading={loading} />
              <KPICard title="PAX Total (B2B+B2C)" value={combinedPAX}
                valueType="int" icon="🎫" color="green" loading={loading} />
              <KPICard title="% Realizare Plan" value={combinedVsPlanPct}
                valueType="pct"
                deltaLabel={combinedPlan ? `${fmtEur(combinedRevenue)} / ${fmtEur(combinedPlan)}` : 'Date B2B indisponibile'}
                icon="🎯" color="purple" loading={loading} />
            </div>

            {/* Period toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 font-medium">Vedere:</span>
              <PeriodToggle value={period} onChange={setPeriod} />
              {period === 'monthly' && (
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-xs text-gray-400">Compară cu:</span>
                  {[year - 2, year - 1].map(cy => (
                    <button key={cy} onClick={() => setCompareYear(cy)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        compareYear === cy ? 'bg-ct-navy text-white' : 'bg-white text-gray-600 border border-gray-200'
                      }`}>
                      {cy}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <RevenueChart data={overviewChartData} title={overviewChartTitle}
                  showLY={period === 'monthly'} showPlan />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <GaugeCard title="Plan Total" actual={combinedRevenue} target={combinedPlan} color="#E8440A" />
                <GaugeCard title="Plan B2C" actual={b2cSummary?.revenue} target={b2cSummary?.plan} color="#1A2B5F" />
              </div>
            </div>

          </>
        )}

        {/* ── B2B TAB ───────────────────────────────────────────────────────── */}
        {tab === 'b2b' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Plan B2B" value={b2bSummary?.plan}
                deltaLabel="Target anual"
                icon="💼" color="orange" loading={loading} />
              <KPICard title="PAX" value={b2bSummary?.bookings}
                valueType="int" icon="🎫" color="green" loading={loading} />
              <KPICard title="Plan" value={b2bSummary?.plan}
                icon="📋" color="navy" loading={loading} />
              <KPICard title="% vs Plan" value={null}
                valueType="pct" icon="🎯" color="purple" loading={loading} />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 font-medium">Vedere:</span>
              <PeriodToggle value={period} onChange={setPeriod} />
              {period === 'monthly' && (
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-xs text-gray-400">Compară cu:</span>
                  {[year - 2, year - 1].map(cy => (
                    <button key={cy} onClick={() => setCompareYear(cy)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        compareYear === cy ? 'bg-ct-navy text-white' : 'bg-white text-gray-600 border border-gray-200'
                      }`}>
                      {cy}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {period === 'yearly' ? (
              <YearlyChart b2bData={b2bYearly} b2cData={[]} loading={loading} />
            ) : (
              <RevenueChart
                data={b2bChartData}
                title={b2bTabChartTitle}
                showLY={false} showPlan
                height={360}
              />
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <AgencyTable data={agencies} loading={loading} />
              </div>
              <GaugeCard title={`Plan B2B ${year}`}
                actual={null} target={b2bSummary?.plan} color="#E8440A" />
            </div>
          </>
        )}

        {/* ── B2C TAB ───────────────────────────────────────────────────────── */}
        {tab === 'b2c' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Vânzări B2C" value={b2cSummary?.revenue}
                delta={b2cSummary?.vs_ly_pct} deltaLabel={`vs ${compareYear}`}
                icon="🌐" color="navy" loading={loading} />
              <KPICard title="PAX" value={b2cSummary?.bookings}
                valueType="int" icon="🎫" color="green" loading={loading} />
              <KPICard title="Plan" value={b2cSummary?.plan}
                icon="📋" color="orange" loading={loading} />
              <KPICard title="% vs Plan" value={b2cSummary?.vs_plan_pct}
                valueType="pct" icon="🎯" color="purple" loading={loading} />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-500 font-medium">Vedere:</span>
              <PeriodToggle value={period} onChange={setPeriod} options={B2C_PERIODS} />
              {period === 'monthly' && (
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-xs text-gray-400">Compară cu:</span>
                  {[year - 2, year - 1].map(cy => (
                    <button key={cy} onClick={() => setCompareYear(cy)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        compareYear === cy ? 'bg-ct-navy text-white' : 'bg-white text-gray-600 border border-gray-200'
                      }`}>
                      {cy}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {period === 'yearly' && (
              <YearlyChart b2bData={[]} b2cData={b2cYearly} loading={loading} />
            )}
            {period === 'daily' && (
              <DailyChart
                data={b2cDaily}
                title={`B2C — Zilnic vs An Anterior (ultimele ${b2cDays} zile)`}
                days={b2cDays}
                onDaysChange={setB2cDays}
                loading={loading}
              />
            )}
            {period === 'weekly' && (
              <WeeklyChart
                data={b2cWeekly}
                title="B2C — Evoluție Săptămânală (16 săpt.) vs An Anterior"
                loading={loading}
              />
            )}
            {(period === 'recent' || period === 'monthly') && (
              <RevenueChart
                data={b2cChartData}
                title={b2cTabChartTitle}
                showLY showPlan
                height={360}
              />
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <RevenueChart data={outlookMonthly} title="Outlook / Forecast Plan"
                  showLY={false} showPlan />
              </div>
              <GaugeCard title={`Plan B2C ${year}`}
                actual={b2cSummary?.revenue} target={b2cSummary?.plan} color="#1A2B5F" />
            </div>
          </>
        )}

        {/* ── BRANCHES TAB ─────────────────────────────────────────────────── */}
        {tab === 'branches' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Parteneri B2B Activi" value={agencies.length}
                valueType="int" icon="🤝" color="orange" loading={loading} />
              <KPICard title="Sucursale B2C Active" value={b2cBranches.length}
                valueType="int" icon="🏪" color="navy" loading={loading} />
              <KPICard title="Top Partener B2B"
                value={agencies[0]?.pax ?? null}
                valueType="int"
                deltaLabel={agencies[0]?.agency}
                icon="🥇" color="green" loading={loading} />
              <KPICard title="Top Sucursală B2C"
                value={b2cBranches[0]?.revenue ?? null}
                deltaLabel={b2cBranches[0]?.branch}
                icon="🥇" color="purple" loading={loading} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">B2B — Top Parteneri (PAX)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="pb-2 font-semibold text-gray-500 text-xs">#</th>
                        <th className="pb-2 font-semibold text-gray-500 text-xs">Partener / Agenție</th>
                        <th className="pb-2 font-semibold text-gray-500 text-xs text-right">PAX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agencies.slice(0, 30).map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-2 pr-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="py-2 font-medium text-gray-800">{row.agency}</td>
                          <td className="py-2 text-right font-semibold text-gray-900">
                            {row.pax ? row.pax.toLocaleString('en') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <BranchTable
                data={b2cBranches}
                loading={loading}
                color="#1A2B5F"
                title="B2C / Site — Vânzări per Sucursală"
              />
            </div>
          </>
        )}

        {/* ── MULTI-YEAR TAB ───────────────────────────────────────────────── */}
        {tab === 'yearly' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {b2bYearly.slice(-3).map(d => (
                <KPICard key={d.year} title={`B2B ${d.year}`} value={d.revenue}
                  icon="💼" color="orange" loading={loading} />
              ))}
              {b2cYearly.slice(-1).map(d => (
                <KPICard key={`b2c-${d.year}`} title={`B2C ${d.year}`} value={d.revenue}
                  icon="🌐" color="navy" loading={loading} />
              ))}
            </div>

            <YearlyChart b2bData={b2bYearly} b2cData={b2cYearly} loading={loading} height={380} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-4">B2B — Evoluție pe Ani</h3>
                <div className="space-y-3">
                  {b2bYearly.map((d, i) => {
                    const prev = b2bYearly[i - 1]
                    const growth = prev?.revenue ? ((d.revenue / prev.revenue - 1) * 100) : null
                    return (
                      <div key={d.year} className="flex items-center justify-between py-2 border-b border-gray-50">
                        <div className="font-semibold text-gray-800">{d.year}</div>
                        <div className="font-bold text-gray-900">{fmtEur(d.revenue)}</div>
                        {growth !== null && (
                          <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            growth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-4">B2C — Evoluție pe Ani</h3>
                <div className="space-y-3">
                  {b2cYearly.length > 0 ? b2cYearly.map((d, i) => {
                    const prev = b2cYearly[i - 1]
                    const growth = prev?.revenue ? ((d.revenue / prev.revenue - 1) * 100) : null
                    return (
                      <div key={d.year} className="flex items-center justify-between py-2 border-b border-gray-50">
                        <div className="font-semibold text-gray-800">{d.year}</div>
                        <div className="font-bold text-gray-900">{fmtEur(d.revenue)}</div>
                        {growth !== null && (
                          <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            growth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    )
                  }) : (
                    <p className="text-sm text-gray-400 text-center py-8">
                      Date B2C indisponibile — verifică fișierul Excel (sheet "etrip"/"tina")
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8 py-4">
        <div className="max-w-screen-2xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
          <span>© {new Date().getFullYear()} Christian Tour — Sales Dashboard</span>
          <span>Date actualizate automat la fiecare oră din SharePoint</span>
        </div>
      </footer>
    </div>
  )
}
