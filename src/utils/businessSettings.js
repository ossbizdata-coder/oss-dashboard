import { getDaysInMonth } from 'date-fns'

export const SHOP_CODES = ['CAFE', 'BOOKSHOP', 'FOODHUT']

export const DEFAULT_BUSINESS_SETTINGS = {
  profitRates: {
    CAFE: 12,
    BOOKSHOP: 15,
    FOODHUT: 20,
  },
  fixedMonthlyExpenses: {
    rent: 0,
    electric: 0,
    internet: 0,
    other: 0,
  },
}

const STORAGE_KEY = 'oss-business-settings'

export function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeProfitRates(rates = {}) {
  return SHOP_CODES.reduce((acc, shopCode) => {
    acc[shopCode] = toNumber(rates[shopCode] ?? DEFAULT_BUSINESS_SETTINGS.profitRates[shopCode])
    return acc
  }, {})
}

function normalizeFixedMonthlyExpenses(expenses = {}) {
  return {
    rent: toNumber(expenses.rent ?? DEFAULT_BUSINESS_SETTINGS.fixedMonthlyExpenses.rent),
    electric: toNumber(expenses.electric ?? DEFAULT_BUSINESS_SETTINGS.fixedMonthlyExpenses.electric),
    internet: toNumber(expenses.internet ?? DEFAULT_BUSINESS_SETTINGS.fixedMonthlyExpenses.internet),
    other: toNumber(expenses.other ?? DEFAULT_BUSINESS_SETTINGS.fixedMonthlyExpenses.other),
  }
}

export function normalizeBusinessSettings(settings = {}) {
  return {
    profitRates: normalizeProfitRates(settings.profitRates),
    fixedMonthlyExpenses: normalizeFixedMonthlyExpenses(settings.fixedMonthlyExpenses),
  }
}

export function getBusinessSettings() {
  if (typeof window === 'undefined') {
    return normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS)
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS)
    return normalizeBusinessSettings(JSON.parse(raw))
  } catch (_) {
    return normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS)
  }
}

export function saveBusinessSettings(settings) {
  const normalized = normalizeBusinessSettings(settings)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
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
  const normalized = settings ? normalizeBusinessSettings(settings) : getBusinessSettings()
  return toNumber(normalized.profitRates?.[shopCode] ?? DEFAULT_BUSINESS_SETTINGS.profitRates[shopCode])
}

export function calculateConfiguredProfit(shopCode, salesAmount, settings) {
  const sales = Math.max(0, toNumber(salesAmount))
  const rate = getProfitRate(settings, shopCode)
  return Math.round((sales * rate) / 100)
}

export function getTotalFixedMonthlyExpenses(settings) {
  const normalized = settings ? normalizeBusinessSettings(settings) : getBusinessSettings()
  const values = normalized.fixedMonthlyExpenses || {}
  return Object.values(values).reduce((sum, value) => sum + toNumber(value), 0)
}

export function getDailyFixedExpenseShare(settings, targetDate = new Date()) {
  const daysInMonth = getDaysInMonth(targetDate)
  if (!daysInMonth) return 0
  return getTotalFixedMonthlyExpenses(settings) / daysInMonth
}

export function sanitizeDisplayText(value, fallback = 'Other') {
  if (value == null) return fallback
  const text = String(value).trim()
  if (!text || /^null$/i.test(text) || /^undefined$/i.test(text)) return fallback
  return text
}

