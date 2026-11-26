import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Brain, RefreshCw, ShieldAlert } from 'lucide-react'
import { format, subDays } from 'date-fns'
import api, { dailyCashApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState, formatRs, Badge } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

const SHOPS = [
  { code: 'CAFE', label: 'Cafe' },
  { code: 'BOOKSHOP', label: 'Bookshop' },
  { code: 'FOODHUT', label: 'Food Hut' },
]

const SHOP_IDS = { CAFE: 1, BOOKSHOP: 2, FOODHUT: 3 }

const toNum = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toTs = (tx) => {
  const source = tx?.transactionTime || tx?.createdAt
  if (!source) return 0
  const parsed = new Date(source).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

const isEhOrder = (tx) => {
  const text = `${tx?.itemName || ''} ${tx?.item || ''} ${tx?.comment || ''}`.toLowerCase()
  return tx?.category === 'SALE' && /(^|\b)(eh|elephant\s*house)(\b|$)/i.test(text)
}

const severityOrder = { high: 3, medium: 2, low: 1 }

export default function AnalysisPage() {
  const { isOwnerUser } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [windowDays, setWindowDays] = useState(14)
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState([])
  const [incidents, setIncidents] = useState([])
  const [loadIssueCount, setLoadIssueCount] = useState(0)

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')

  const load = async () => {
    setLoading(true)
    try {
      const dates = Array.from({ length: windowDays }, (_, index) => format(subDays(selectedDate, index), 'yyyy-MM-dd'))
      const tasks = []

      dates.forEach((dateStr) => {
        SHOPS.forEach((shop) => {
          tasks.push((async () => {
            const [summaryRes, txRes] = await Promise.allSettled([
              dailyCashApi.getSummary(shop.code, dateStr),
              api.get('/transactions/by-date', {
                params: { department: SHOP_IDS[shop.code], date: dateStr },
              }),
            ])

            return {
              date: dateStr,
              shopCode: shop.code,
              shopLabel: shop.label,
              summary: summaryRes.status === 'fulfilled' ? (summaryRes.value?.data || {}) : null,
              transactions: txRes.status === 'fulfilled' ? (txRes.value?.data || []) : [],
              hasLoadIssue: summaryRes.status !== 'fulfilled' || txRes.status !== 'fulfilled',
            }
          })())
        })
      })

      const settled = await Promise.allSettled(tasks)
      const normalized = settled
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)

      setRecords(normalized)
      setLoadIssueCount(normalized.filter((row) => row.hasLoadIssue).length)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [selectedDateStr, windowDays])

  useEffect(() => {
    const nextIncidents = []

    records.forEach((row) => {
      const sales = toNum(row.summary?.totalSales)
      const expenses = toNum(row.summary?.totalExpenses)
      const credits = toNum(row.summary?.totalCredits)
      const txs = (row.transactions || []).slice().sort((left, right) => toTs(left) - toTs(right))

      if (sales === 0 && expenses > 0) {
        nextIncidents.push({
          severity: 'high',
          title: 'Expenses recorded without sales',
          message: `${row.shopLabel} on ${row.date} has ${formatRs(expenses)} expenses with zero sales.`,
        })
      }

      if (sales > 0 && expenses >= sales * 0.7 && expenses >= 5000) {
        nextIncidents.push({
          severity: 'medium',
          title: 'Expense-heavy day',
          message: `${row.shopLabel} on ${row.date} spent ${formatRs(expenses)} against sales ${formatRs(sales)}.`,
        })
      }

      if (credits >= sales * 0.6 && credits >= 3000) {
        nextIncidents.push({
          severity: 'medium',
          title: 'High credits concentration',
          message: `${row.shopLabel} on ${row.date} has credits ${formatRs(credits)} vs sales ${formatRs(sales)}.`,
        })
      }

      let currentEh = 0
      let maxEh = 0
      txs.forEach((tx) => {
        if (isEhOrder(tx)) {
          currentEh += 1
          maxEh = Math.max(maxEh, currentEh)
        } else {
          currentEh = 0
        }
      })

      if (maxEh >= 2) {
        nextIncidents.push({
          severity: maxEh >= 3 ? 'high' : 'medium',
          title: 'Consecutive EH orders detected',
          message: `${row.shopLabel} on ${row.date} has ${maxEh} consecutive EH/Elephant House sale orders.`,
        })
      }

      const duplicateMap = {}
      txs.forEach((tx) => {
        if (tx?.category !== 'SALE') return
        const itemName = String(tx?.itemName || tx?.item || '').trim().toLowerCase()
        const amount = toNum(tx?.amount)
        if (!itemName || !amount) return
        const key = `${itemName}|${amount}`
        duplicateMap[key] = (duplicateMap[key] || 0) + 1
      })

      Object.entries(duplicateMap).forEach(([key, count]) => {
        if (count < 4) return
        const [itemName, amount] = key.split('|')
        nextIncidents.push({
          severity: 'low',
          title: 'Repeated same sale pattern',
          message: `${row.shopLabel} on ${row.date}: "${itemName}" at ${formatRs(amount)} repeated ${count} times.`,
        })
      })
    })

    nextIncidents.sort((left, right) => {
      const bySeverity = severityOrder[right.severity] - severityOrder[left.severity]
      if (bySeverity !== 0) return bySeverity
      return left.title.localeCompare(right.title)
    })

    setIncidents(nextIncidents)
  }, [records])

  const insightSummary = useMemo(() => {
    const high = incidents.filter((item) => item.severity === 'high').length
    const medium = incidents.filter((item) => item.severity === 'medium').length
    const low = incidents.filter((item) => item.severity === 'low').length
    return { high, medium, low, total: incidents.length }
  }, [incidents])

  const ownerObservations = useMemo(() => {
    if (incidents.length === 0) return []
    const shopCounts = incidents.reduce((acc, item) => {
      const shop = SHOPS.find((row) => item.message.includes(row.label))?.label || 'Unknown'
      acc[shop] = (acc[shop] || 0) + 1
      return acc
    }, {})
    const topShop = Object.entries(shopCounts).sort((a, b) => b[1] - a[1])[0]
    const observations = []
    if (topShop) observations.push(`${topShop[0]} has the highest suspicious signal count (${topShop[1]}).`)
    if (insightSummary.high > 0) observations.push(`${insightSummary.high} high-risk incident(s) need immediate owner attention.`)
    if (loadIssueCount > 0) observations.push(`${loadIssueCount} shop-day records had partial load issues; verify backend data completeness.`)
    return observations
  }, [incidents, insightSummary.high, loadIssueCount])

  if (!isOwnerUser) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Owner Access Only</h2>
        <p className="text-gray-500">This analysis showcase is available only for userId 1.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Analysis"
        subtitle="Owner-only suspicious activity showcase from daily business data"
        action={(
          <>
            <input
              type="date"
              value={selectedDateStr}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(event) => event.target.value && setSelectedDate(new Date(event.target.value + 'T00:00:00'))}
              className="text-sm font-medium bg-white border border-gray-200 rounded-2xl px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-primary-400"
            />
            <select
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
              className="text-sm font-medium bg-white border border-gray-200 rounded-2xl px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
              <RefreshCw size={14} /> Refresh
            </button>
          </>
        )}
      />

      {loading ? <LoadingSpinner size="lg" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card border-l-4 border-red-500">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">High Risk</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{insightSummary.high}</p>
            </div>
            <div className="card border-l-4 border-orange-500">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Medium Risk</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{insightSummary.medium}</p>
            </div>
            <div className="card border-l-4 border-blue-500">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Low Risk</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{insightSummary.low}</p>
            </div>
            <div className="card border-l-4 border-purple-500">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Total Findings</p>
              <p className="text-2xl font-bold text-purple-700 mt-1">{insightSummary.total}</p>
            </div>
          </div>

          <div className="card mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Brain size={16} className="text-primary-700" />
              AI-assisted observations
            </h2>
            {ownerObservations.length === 0 ? (
              <p className="text-sm text-gray-500">No additional observations for the selected window.</p>
            ) : (
              <div className="space-y-2">
                {ownerObservations.map((note) => (
                  <div key={note} className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-primary-900">
                    {note}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <ShieldAlert size={16} className="text-red-600" />
              Suspicious incidents
            </h2>
            {incidents.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="No suspicious incidents" description="No abnormal patterns found in this period." />
            ) : (
              <div className="space-y-2">
                {incidents.map((incident, index) => (
                  <div key={`${incident.title}-${incident.message}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{incident.title}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{incident.message}</p>
                      </div>
                      <Badge color={incident.severity === 'high' ? 'red' : incident.severity === 'medium' ? 'orange' : 'blue'}>
                        {incident.severity.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

