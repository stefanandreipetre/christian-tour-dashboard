import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''
const api  = axios.create({ baseURL: BASE })

const empty = () => Promise.resolve([])
const nil   = () => Promise.resolve(null)

export const getStatus         = ()                    => api.get('/api/status').then(r => r.data)

// B2C
export const getB2CSummary     = (year, month)         => api.get('/api/b2c/summary',  { params: { year, month } }).then(r => r.data)
export const getB2CMonthly     = (year)                => api.get('/api/b2c/monthly',  { params: { year } }).then(r => r.data)
export const getB2CBranches    = (year, maxMonth)      => api.get('/api/b2c/branches', { params: { year, ...(maxMonth ? { max_month: maxMonth } : {}) } }).then(r => r.data)

// B2B
export const getB2BSummary     = (year, month)         => api.get('/api/b2b/summary',  { params: { year, month } }).then(r => r.data)
export const getB2BMonthly     = (year)                => api.get('/api/b2b/monthly',  { params: { year } }).then(r => r.data)
export const getB2BPartners    = (year)                => api.get('/api/b2b/partners', { params: { year } }).then(r => r.data)

// Stubs for removed endpoints (return empty so components degrade gracefully)
export const getOverview       = nil
export const getB2CYearly      = empty
export const getB2CRecent      = (n)  => getB2CMonthly()
export const getB2CDaily       = empty
export const getB2CWeekly      = empty
export const getB2BYearly      = empty
export const getB2BRecent      = (n)  => getB2BMonthly()
export const getB2BAgencies    = (year, maxMonth) => api.get('/api/b2b/partners', { params: { year, ...(maxMonth ? { max_month: maxMonth } : {}) } }).then(r => r.data)
export const getB2BBranches    = empty
export const getB2BvsTarget    = empty
export const getOutlookMonthly = empty
export const getOutlookSummary = empty
export const getRaw            = empty
export const triggerRefresh    = ()   => api.get('/api/refresh').then(r => r.data)
