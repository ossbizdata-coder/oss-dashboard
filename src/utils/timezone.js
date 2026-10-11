/**
 * Sri Lanka Time (SLT) utility — Asia/Colombo = UTC+5:30
 * Used for all timestamp display in the OSS Dashboard
 */
const SL_TZ = 'Asia/Colombo'

/**
 * Format a UTC date string / Instant / epoch to Sri Lanka local time.
 * Outputs: "3 May 2026, 14:35" (short format)
 */
export function formatSLT(utcVal, opts = {}) {
  if (!utcVal) return '—'
  try {
    const d = new Date(utcVal)
    if (isNaN(d.getTime())) return '—'
    const defaults = {
      timeZone: SL_TZ,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
    return new Intl.DateTimeFormat('en-LK', { ...defaults, ...opts }).format(d)
  } catch {
    return '—'
  }
}

/**
 * Format date only (no time) in SLT — "3 May 2026"
 */
export function formatSLDate(utcVal) {
  if (!utcVal) return '—'
  try {
    const d = new Date(utcVal)
    if (isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('en-LK', {
      timeZone: SL_TZ,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    return '—'
  }
}

/**
 * Format time only in SLT — "14:35"
 */
export function formatSLTime(utcVal) {
  if (!utcVal) return '—'
  try {
    const d = new Date(utcVal)
    if (isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('en-LK', {
      timeZone: SL_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return '—'
  }
}

/**
 * Short compact format — "May 3, 14:35"
 */
export function formatSLShort(utcVal) {
  if (!utcVal) return '—'
  try {
    const d = new Date(utcVal)
    if (isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('en-LK', {
      timeZone: SL_TZ,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return '—'
  }
}

