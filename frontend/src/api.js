import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''
const api  = axios.create({ baseURL: BASE })

export const getStatus        = ()              => api.get('/api/status').then(r => r.data)
export const getOverview      = (year)          => api.get('/api/overview',        { params: { year } }).then(r => r.data)

// B2B
export const getB2BSummary    = (year, month)   => api.get('/api/b2b/summary',     { params: { year, month } }).then(r => r.data)
export const getB2BMonthly    = (year, cmpYear) => api.get('/api/b2b/monthly',     { params: { year, compare_year: cmpYear } }).then(r => r.data)
export const getB2BYearly     = ()              => api.get('/api/b2b/yearly').then(r => r.data)
export const getB2BRecent     = (n = 8)         => api.get('/api/b2b/recent',      { params: { n } }).then(r => r.data)
export const getB2BAgencies   = (year, top=20)  => api.get('/api/b2b/agencies',    { params: { year, top } }).then(r => r.data)
export const getB2BBranches   = (year, top=30)  => api.get('/api/b2b/branches',    { params: { year, top } }).then(r => r.data)
export const getB2BvsTarget   = (year, month)   => api.get('/api/b2b/vs-target',   { params: { year, month } }).then(r => r.data)

// B2C
export const getB2CSummary    = (year, month)   => api.get('/api/b2c/summary',     { params: { year, month } }).then(r => r.data)
export const getB2CMonthly    = (year, cmpYear) => api.get('/api/b2c/monthly',     { params: { year, compare_year: cmpYear } }).then(r => r.data)