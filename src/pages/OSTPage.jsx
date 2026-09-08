import React, { useEffect, useState } from 'react'
import ostApi from '../services/ostApi'

export default function OSTPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ostApi.getSummary('day')
      .then(r => { if (mounted) setSummary(r.data) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">OneStopTransport (OST) — Summary</h1>

      <section className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="p-4 bg-white shadow rounded">
          <h3 className="text-sm text-gray-500">Driver Status</h3>
          <div className="text-xl font-bold">{loading ? 'Loading...' : (summary?.driverStatus ?? 'Unknown')}</div>
        </div>

        <div className="p-4 bg-white shadow rounded">
          <h3 className="text-sm text-gray-500">Total Earnings (period)</h3>
          <div className="text-xl font-bold">{loading ? 'Loading...' : (summary?.totalEarnings ?? 0)}</div>
        </div>

        <div className="p-4 bg-white shadow rounded">
          <h3 className="text-sm text-gray-500">Total Fuel</h3>
          <div className="text-xl font-bold">{loading ? 'Loading...' : (summary?.totalFuel ?? 0)}</div>
        </div>
      </section>

      <div className="mt-6 p-4 bg-white shadow rounded">
        <h2 className="font-medium mb-2">Daily / Monthly Summary (Raw)</h2>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <pre className="text-xs">{JSON.stringify(summary, null, 2)}</pre>
        )}
      </div>
    </div>
  )
}
