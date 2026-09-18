import { getDaysInMonth } from 'date-fns'

export const SHOP_CODES = ['CAFE', 'BOOKSHOP', 'FOODHUT']
export const BUSINESS_SETTINGS_UPDATED_EVENT = 'oss-business-settings-updated'

const STORAGE_KEY = 'oss-business-settings'
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/

export const DEFAULT_BUSINESS_SETTINGS = {
  monthKey: '',
  profitRates: {
    CAFE: 12,
    BOOKSHOP: 15,
    FOODHUT: 25,
  },
  fixedMonthlyExpenses: {
    buildingRental: 0,
    electricityBill: 0,
    internetFees: 0,
    other: 0,
  },
}

export function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function canSyncBusinessSettings() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('role') === 'SUPERADMIN'
}

export function getMonthKey(targetDate = new Date()) {
  if (typeof targetDate === 'string' && MONTH_KEY_PATTERN.test(targetDate.trim())) {
    return targetDate.trim()
  }

  const resolved = targetDate instanceof Date ? targetDate : new Date(targetDate)
  const safeDate = Number.isNaN(resolved.getTime()) ? new Date() : resolved

  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}`
}

function normalizeProfitRates(rates = {}) {
  return SHOP_CODES.reduce((acc, shopCode) => {
    acc[shopCode] = toNumber(rates[shopCode] ?? DEFAULT_BUSINESS_SETTINGS.profitRates[shopCode])
    return acc
  }, {})
}

function normalizeFixedMonthlyExpenses(expenses = {}) {
  return {
    buildingRental: toNumber(expenses.buildingRental ?? expenses.rent ?? DEFAULT_BUSINESS_SETTINGS.fixedMonthlyExpenses.buildingRental),
    electricityBill: toNumber(expenses.electricityBill ?? expenses.electric ?? DEFAULT_BUSINESS_SETTINGS.fixedMonthlyExpenses.electricityBill),
    internetFees: toNumber(expenses.internetFees ?? expenses.internet ?? DEFAULT_BUSINESS_SETTINGS.fixedMonthlyExpenses.internetFees),
    other: toNumber(expenses.other ?? DEFAULT_BUSINESS_SETTINGS.fixedMonthlyExpenses.other),
  }
}

function getCachedPayload() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (_) {
    return null
  }
}

function getCachedMonthlySettings(targetDate = new Date()) {
  const monthKey = getMonthKey(targetDate)
  const cached = getCachedPayload()

  if (!cached) return null

  if (cached.profitRates || cached.fixedMonthlyExpenses) {
    return {
      monthKey,
      profitRates: cached.profitRates,
      fixedMonthlyExpenses: cached.fixedMonthlyExpenses,
    }
  }

  return {
    monthKey,
    profitRates: cached.profitRates,
    fixedMonthlyExpenses: cached.fixedMonthlyExpensesByMonth?.[monthKey],
  }
}

function dispatchBusinessSettingsUpdated(monthKey) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(BUSINESS_SETTINGS_UPDATED_EVENT, { detail: { monthKey } }))
}

export function normalizeBusinessSettings(settings = {}, targetDate = new Date()) {
  const monthKey = getMonthKey(settings.monthKey ?? settings.month ?? targetDate)

  return {
    monthKey,
    profitRates: normalizeProfitRates(settings.profitRates),
    fixedMonthlyExpenses: normalizeFixedMonthlyExpenses(settings.fixedMonthlyExpenses),
  }
}

export function extractBusinessSettingsPayload(payload = {}, targetDate = new Date()) {
  if (payload && typeof payload === 'object' && payload.settings && typeof payload.settings === 'object') {
    return normalizeBusinessSettings({
      ...payload.settings,
      monthKey: payload.settings.monthKey ?? payload.monthKey ?? payload.month,
    }, targetDate)
  }

  return normalizeBusinessSettings(payload, targetDate)
}

export function toBusinessSettingsPayload(settings = {}, targetDate = new Date()) {
  const normalized = normalizeBusinessSettings(settings, targetDate)
  const [year, month] = normalized.monthKey.split('-').map(Number)

  return {
    monthKey: normalized.monthKey,
    year,
    month,
    profitRates: normalized.profitRates,
    fixedMonthlyExpenses: {
      ...normalized.fixedMonthlyExpenses,
      rent: normalized.fixedMonthlyExpenses.buildingRental,
      electric: normalized.fixedMonthlyExpenses.electricityBill,
      internet: normalized.fixedMonthlyExpenses.internetFees,
    },
  }
}

export function getBusinessSettings(targetDate = new Date()) {
  if (typeof window === 'undefined') {
    return normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS, targetDate)
  }

  const cached = getCachedMonthlySettings(targetDate)
  if (!cached) return normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS, targetDate)
  return normalizeBusinessSettings(cached, targetDate)
}

export function saveBusinessSettings(settings, targetDate = new Date()) {
  const normalized = normalizeBusinessSettings(settings, targetDate)

  if (typeof window !== 'undefined') {
    const current = getCachedPayload()
    const next = current && !(current.profitRates || current.fixedMonthlyExpenses)
      ? current
      : { profitRates: DEFAULT_BUSINESS_SETTINGS.profitRates, fixedMonthlyExpensesByMonth: {} }

    next.profitRates = normalized.profitRates
    next.fixedMonthlyExpensesByMonth = {
      ...(next.fixedMonthlyExpensesByMonth || {}),
      [normalized.monthKey]: normalized.fixedMonthlyExpenses,
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    dispatchBusinessSettingsUpdated(normalized.monthKey)
  }

  return normalized
}

export function calculateCalculatedSales(summary = {}) {
  return Math.max(0, toNumber(summary.calculatedSales ?? summary.totalSales))
}

export function calculateRevenue(summary = {}) {
  const calculatedSales = calculateCalculatedSales(summary)
  const credits = Math.max(0, toNumber(summary.totalCredits))
  return Math.max(0, calculatedSales - credits)
}

export function getProfitRate(settings, shopCode) {
  const normalized = settings ? extractBusinessSettingsPayload(settings) : getBusinessSettings()
  return toNumber(normalized.profitRates?.[shopCode] ?? DEFAULT_BUSINESS_SETTINGS.profitRates[shopCode])
}

export function calculateConfiguredProfit(shopCode, salesAmount, settings) {
  const sales = Math.max(0, toNumber(salesAmount))
  const rate = getProfitRate(settings, shopCode)
  return Math.round((sales * rate) / 100)
}

export function getTotalFixedMonthlyExpenses(settings, targetDate = new Date()) {
  const normalized = settings ? extractBusinessSettingsPayload(settings, targetDate) : getBusinessSettings(targetDate)
  const values = normalized.fixedMonthlyExpenses || {}
  return Object.values(values).reduce((sum, value) => sum + toNumber(value), 0)
}

export function getDailyFixedExpenseShare(settings, targetDate = new Date()) {
  const daysInMonth = getDaysInMonth(targetDate)
  if (!daysInMonth) return 0
  return getTotalFixedMonthlyExpenses(settings, targetDate) / daysInMonth
}

export function sanitizeDisplayText(value, fallback = 'Other') {
  if (value == null) return fallback
  const text = String(value).trim()
  if (!text || /^null$/i.test(text) || /^undefined$/i.test(text)) return fallback
  return text
}
