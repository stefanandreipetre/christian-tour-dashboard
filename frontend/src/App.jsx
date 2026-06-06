import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import KPICard from './components/KPICard'
import RevenueChart from './components/RevenueChart'
import AgencyTable from './components/AgencyTable'
import GaugeCard from './components/GaugeCard'
import ChannelCompare from './components/ChannelCompare'
import StatusBanner from './components/StatusBanner'
import {
  getStatus, getOverview, getB2BMonthly, getB2CMonthly,
  getB2BAgencies, getB2BvsTarget, getOutlookMonthly
} from './api'

const TABS = [
  { id: 'overview',  label: 'Overview'    },
  { id: 'b2b',       label: 'B2B'         },
  { id: 'b2c',       label: 'B2C / Site'  },
  { id: 'outlook',   label: 'Outlook'     },
]

// ─── icons ───────────────────────────────────────────────────────────────────
const Icon = {
  revenue: '₊',
  bookings: '🎫',
  growth: '📈',
  plan: '🎯',
}

export default function App() {
  const [tab, setTab] = useState('overview')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(null)
  const [compareYear, setCompareYear] = useState(year - 1)

  const [status, setStatus] = useState(null)
  const [overview, setOverview] = useState(null)
  const [b2bMonthly, setB2bMonthly] = useState([])
  const [b2cMonthly, setB2cMonthly] = useState([])
  const [agencies, setAgencies] = useState([])
  const [b2bVsTarget, setB2bVsTarget] = useState(null)
  const [outlookMonthly, setOutlookMonthly] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [st, ov, b2bM, b2cM, ag, bvt, outM] = await Promise.allSettled([
        getStatus(),
        getOverview(year),
        getB2BMonthly(year, compareYear),
        getB2CMonthly(year, compareYear),
        getB2BAgencies(year, 30),
        getB2BvsTarget(year, month),
        getOutlookMonthly(year),
      ])

      if (st.status === 'fulfilled') setStatus(st.value)
      if (ov.status === 'fulfilled') setOverview(ov.value)
      if (b2bM.status === 'fulfilled') setB2bMonthly(b2bM.value)
      if (b2cM.status === 'fulfilled') setB2cMonthly(b2cM.value)
      if (ag.status === 'fulfilled') setAgencies(ag.value)
      if (bvt.status === 'fulfilled') setB2bVsTarget(bvt.value)
      if (outM.status === 'fulfilled') setOutlookMonthly(outM.value)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [year, month, compareYear])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh every 5 minutes in browser
  useEffect(() => {
    const id = setInterval(fetchAll, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchAll])

  const b2bSummary = overview?.b2b?.summary
  const b2cSummary = overview?.b2c?.summary
  const lastUpdated = status ? Math.max(...Object.values(status.sources).map(s => s.updated_at || 0)) : null

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
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
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
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Vânzări B2B"
                value={b2bSummary?.revenue}
                delta={b2bSummary?.vs_ly_pct}
                deltaLabel={`vs ${compareYear}`}
                icon={<span className="font-bold">B2</span>}
                color="orange"
                loading={loading}
              />
              <KPICard
                title="Vânzări B2C / Site"
                value={b2cSummary?.revenue}
                delta={b2cSummary?.vs_ly_pct}
                deltaLabel={`vs ${compareYear}`}
                icon={<span className="font-bold">B2</span>}
                color="navy"
                loading={loading}
              />
              <KPICard
                title="Rezervări B2B"
                value={b2bSummary?.bookings}
                valueType="int"
                delta={null}
                icon="🎫"
                color="green"
                loading={loading}
              />
              <KPICard
                title="% Realizare Plan B2B"
                value={b2bSummary?.vs_plan_pct}
                valueType="pct"
                delta={null}
                deltaLabel={b2bSummary?.plan ? `Plan: ${(b2bSummary.plan / 1_000_000).toFixed(1)}M RON` : null}
                icon="🎯"
                color="purple"
                loading={loading}
              />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <RevenueChart
                  data={b2bMonthly}
                  title={`Evoluție Vânzări B2B ${year} vs ${compareYear}`}
                  showLY showPlan
                />
              </div>
              <ChannelCompare
                b2bRevenue={b2bSummary?.revenue}
                b2cRevenue={b2cSummary?.revenue}
              />
            </div>

            {/* B2C Chart + Target gauges */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <RevenueChart
                  data={b2cMonthly}
                  title={`Evoluție Vânzări B2C / Site ${year} vs ${compareYear}`}
                  showLY showPlan={false}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <GaugeCard
                  title="Realizare Plan B2B"
                  actual={b2bSummary?.revenue}
                  target={b2bSummary?.plan}
                  color="#E8440A"
                />
                <GaugeCard
                  title="Realizare Plan B2C"
                  actual={b2cSummary?.revenue}
                  target={b2cSummary?.plan}
                  color="#1A2B5F"
                />
              </div>
            </div>

            {/* Agency table */}
            <AgencyTable data={agencies} loading={loading} />
          </>
        )}

        {/* ── B2B TAB ───────────────────────────────────────────────────────── */}
        {tab === 'b2b' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Vânzări B2B" value={b2bSummary?.revenue} delta={b2bSummary?.vs_ly_pct} deltaLabel={`vs ${compareYear}`} icon="💼" color="orange" loading={loading} />
              <KPICard title="Rezervări" value={b2bSummary?.bookings} valueType="int" icon="🎫" color="green" loading={loading} />
              <KPICard title="Plan" value={b2bSummary?.plan} icon="📋" color="navy" loading={loading} />
              <KPICard title="% vs Plan" value={b2bSummary?.vs_plan_pct} valueType="pct" icon="🎯" color="purple" loading={loading} />
            </div>

            <RevenueChart
              data={b2bVsTarget?.monthly || b2bMonthly}
              title={`B2B — Actual vs Plan vs An Anterior (${year})`}
              showLY showPlan showTarget
              height={360}
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <AgencyTable data={agencies} loading={loading} />
              </div>
              <GaugeCard
                title={`Realizare Plan B2B ${year}`}
                actual={b2bSummary?.revenue}
                target={b2bSummary?.plan}
                color="#E8440A"
              />
            </div>

            {/* Compare year selector */}
            <div className="card flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium text-gray-600">Compară cu:</span>
              {[year - 2, year - 1].map(cy => (
                <button
                  key={cy}
                  onClick={() => setCompareYear(cy)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${compareYear === cy ? 'bg-ct-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {cy}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── B2C TAB ───────────────────────────────────────────────────────── */}
        {tab === 'b2c' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Vânzări B2C" value={b2cSummary?.revenue} delta={b2cSummary?.vs_ly_pct} deltaLabel={`vs ${compareYear}`} icon="🛒" color="navy" loading={loading} />
              <KPICard title="Rezervări" value={b2cSummary?.bookings} valueType="int" icon="🎫" color="green" loading={loading} />
              <KPICard title="Plan" value={b2cSummary?.plan} icon="📋" color="orange" loading={loading} />
              <KPICard title="% vs Plan" value={b2cSummary?.vs_plan_pct} valueType="pct" icon="🎯" color="purple" loading={loading} />
            </div>

            <RevenueChart
              data={b2cMonthly}
              title={`B2C / Site — Evoluție Lunară ${year} vs ${compareYear}`}
              showLY showPlan
              height={360}
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <RevenueChart
                  data={outlookMonthly}
                  title="Outlook / Forecast Site Separat"
                  showLY={false} showPlan
                />
              </div>
              <GaugeCard
                title={`Realizare Plan B2C ${year}`}
                actual={b2cSummary?.revenue}
                target={b2cSummary?.plan}
                color="#1A2B5F"
              />
            </div>
          </>
        )}

        {/* ── OUTLOOK TAB ──────────────────────────────────────────────────── */}
        {tab === 'outlook' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <KPICard title="Total Outlook" value={overview?.outlook?.summary?.revenue} icon="🔭" color="orange" loading={loading} />
              <KPICard title="vs Plan" value={overview?.outlook?.summary?.vs_plan_pct} valueType="pct" icon="🎯" color="navy" loading={loading} />
              <KPICard title="vs An Anterior" value={overview?.outlook?.summary?.vs_ly_pct} valueType="pct" icon="📈" color="green" loading={loading} />
            </div>

            <RevenueChart
              data={outlookMonthly}
              title={`Outlook Vânzări ${year} — Site Separat`}
              showLY showPlan
              height={380}
            />

            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Date Brute — Outlook</h3>
              <p className="text-sm text-gray-500">
                Fișierul <strong>Outlook_CHR_Sales_2026_Site separat.xlsm</strong> este încărcat și procesat automat.
                Dacă datele nu apar, verifică că path-ul este corect în variabilele de mediu.
                Poți accesa datele brute la <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">/api/raw/outlook</code>.
              </p>
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
