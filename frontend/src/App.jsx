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
  getB2BMonthly, getB2BYearly, getB2BRecent, getB2BAgencies, getB2BvsTarget, getB2BBranches,
  getB2CMonthly, getB2CYearly, getB2CRecent, getB2CBranches, getB2CDaily, getB2CWeekly,
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

export default function App() {
  const [tab, setTab]             = useState('overview')
  const [period, setPeriod]       = useState('monthly')
  const [year, setYear]           = useState(new Date().getFullYear())
  const [month, setMonth]         = useState(null)
  const [compareYear, setCompareYear] = useState(new Date().getFullYear() - 1)

  const [status, setStatus]             = useState(null)
  const [overview, setOverview]         = useState(null)
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
        getB2BMonthly(year, compareYear),
        getB2BRecent(8),
        getB2BYearly(),
        getB2CMonthly(year, compareYear),
        getB2CRecent(8),
        getB2CYearly(),
        getB2BAgencies(year, 30),
        getB2BvsTarget(year, month),
        getB2BBranches(year),
        getB2CBranches(year),
        getOutlookMonthly(year),
        getB2CDaily(b2cDays),
        getB2CWeekly(null, 16),
      ])

      const [st, ov, b2bM, b2bR, b2bY, b2cM, b2cR, b2cY, ag, bvt, b2bBr, b2cBr, outM, b2cD, b2cW] = results

      if (st.status    === 'fulfilled') setStatus(st.value)
      if (ov.status    === 'fulfilled') setOverview(ov.value)
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

  const b2bSummary = overview?.b2b?.summary
  const b2cSummary = overview?.b2c?.summary
  const lastUpdated = status
    ? Math.max(...Object.values(status.sources).map(s => s.updated_at || 0))
    : null

  // Period-aware chart data helpers
  const b2bChartData = period === 'recent' ? b2bRecent : b2bMonthly
  const b2cChartData = period === 'recent' ? b2cRecent : b2cMonthly

  const b2bChartTitle = period === 'recent'
    ? 'B2B — Ultimele 8 Luni'
    : `B2B — Evoluție Lunară ${year} vs ${compareYear}`
  const b2cChartTitle = period === 'recent'
    ? 'B2C / Site — Ultimele 8 Luni'
    : `B2C / Site — Evoluție Lunară ${year} vs ${compareYear}`

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
              <KPICard title="Vânzări B2B" value={b2bSummary?.revenue}
                delta={b2bSummary?.vs_ly_pct} deltaLabel={`vs ${compareYear}`}
                icon="💼" color="orange" loading={loading} />
              <KPICard title="Vânzări B2C / Site" value={b2cSummary?.revenue}
                delta={b2cSummary?.vs_ly_pct} deltaLabel={`vs ${compareYear}`}
                icon="🌐" color="navy" loading={loading} />
              <KPICard title="PAX B2B" value={b2bSummary?.bookings}
                valueType="int" icon="🎫" color="green" loading={loading} />
              <KPICard title="% Plan B2B" value={b2bSummary?.vs_plan_pct}
                valueType="pct"
                deltaLabel={b2bSummary?.plan ? `Plan: ${fmtEur(b2bSummary.plan)}` : null}
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
                <RevenueChart data={b2bChartData} title={b2bChartTitle}
                  showLY={period === 'monthly'} showPlan={period === 'monthly'} />
              </div>
              <ChannelCompare b2bRevenue={b2bSummary?.revenue} b2cRevenue={b2cSummary?.revenue} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <RevenueChart data={b2cChartData} title={b2cChartTitle}
                  showLY={period === 'monthly'} showPlan={false} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <GaugeCard title="Plan B2B" actual={b2bSummary?.revenue} target={b2bSummary?.plan} color="#E8440A" />
                <GaugeCard title="Plan B2C" actual={b2cSummary?.revenue} target={b2cSummary?.plan} color="#1A2B5F" />
              </div>
            </div>

            <AgencyTable data={agencies} loading={loading} />
          </>
        )}

        {/* ── B2B TAB ───────────────────────────────────────────────────────── */}
        {tab === 'b2b' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Vânzări B2B" value={b2bSummary?.revenue}
                delta={b2bSummary?.vs_ly_pct} deltaLabel={`vs ${compareYear}`}
                icon="💼" color="orange" loading={loading} />
              <KPICard title="PAX" value={b2bSummary?.bookings}
                valueType="int" icon="🎫" color="green" loading={loading} />
              <KPICard title="Plan" value={b2bSummary?.plan}
                icon="📋" color="navy" loading={loading} />
              <KPICard title="% vs Plan" value={b2bSummary?.vs_plan_pct}
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
                data={period === 'recent' ? b2bRecent : (b2bVsTarget?.monthly || b2bMonthly)}
                title={period === 'recent' ? 'B2B — Ultimele 8 Luni' : `B2B — Actual vs Plan vs An Anterior (${year})`}
                showLY={period === 'monthly'} showPlan={period === 'monthly'} showTarget={period === 'monthly'}
                height={360}
              />
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <AgencyTable data={agencies} loading={loading} />
              </div>
              <GaugeCard title={`Plan B2B ${year}`}
                actual={b2bSummary?.revenue} target={b2bSummary?.plan} color="#E8440A" />
            </div>
          </>
        )}

        {/* ── B2C TAB ───────────────────────────────────────────────────────── */}
        {tab === 'b2c' && (
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
                data={period === 'recent' ? b2cRecent : b2cMonthly}
                title={period === 'recent' ? 'B2C / Site — Ultimele 8 Luni' : `B2C / Site — Evoluție Lunară ${year} vs ${compareYear}`}
                showLY={period === 'monthly'} showPlan={period === 'monthly'}
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
              <KPICard title="Sucursale B2B Active" value={b2bBranches.length}
                valueType="int" icon="🏢" color="orange" loading={loading} />
              <KPICard title="Sucursale B2C Active" value={b2cBranches.length}
                valueType="int" icon="🏪" color="navy" loading={loading} />
              <KPICard title="Top B2B Sucursală"
                value={b2bBranches[0]?.revenue ?? null}
                deltaLabel={b2bBranches[0]?.branch}
                icon="🥇" color="green" loading={loading} />
              <KPICard title="Top B2C Sucursală"
                value={b2cBranches[0]?.revenue ?? null}
                deltaLabel={b2cBranches[0]?.branch}
                icon="🥇" color="purple" loading={loading} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <BranchTable
                data={b2bBranches}
                loading={loading}
                color="#E8440A"
                title="B2B — Vânzări per Zonă / Sucursală"
              />
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
