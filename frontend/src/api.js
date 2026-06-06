import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: BASE })

export const getStatus = () => api.get('/api/status').then(r => r.data)
export const getOverview = (year) => api.get('/api/overview', { params: { year } }).then(r => r.data)

export const getB2BSummary = (year, month) => api.get('/api/b2b/summary', { params: { year, month } }).then(r => r.data)
export const getB2BMonthly = (year, compareYear) => api.get('/api/b2b/monthly', { params: { year, compare_year: compareYear } }).then(r => r.data)
export const getB2BAgencies = (year, top = 20) => api.get('/api/b2b/agencies', { params: { year, top } }).then(r => r.data)
export const getB2BvsTarget = (year, month) => api.get('/api/b2b/vs-target', { params: { year, month } }).then(r => r.data)

export const getB2CSummary = (year, month) => api.get('/api/b2c/summary', { params: { year, month } }).then(r => r.data)
export const getB2CMonthly = (year, compareYear) => api.get('/api/b2c/monthly', { params: { year, compare_year: compareYear } }).then(r => r.data)

export const getOutlookMonthly = (year) => api.get('/api/outlook/monthly', { params: { year } }).then(r => r.data)
export const getOutlookSummary = (year) => api.get('/api/outlook/summary', { params: { year } }).then(r => r.data)

export const getRaw = (source, sheet) => api.get(`/api/raw/${source}`, { params: { sheet } }).then(r => r.data)

export const triggerRefresh = () => api.post('/api/refresh').then(r => r.data)
