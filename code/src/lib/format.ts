/** Parse an ISO-8601 duration like "PT1H2M3S" or "P1DT2H" into seconds. */
export function parseIsoDuration(iso: string | undefined | null): number {
  if (!iso) return 0
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso)
  if (!m) return 0
  const [, w, d, h, min, s] = m
  return (
    Number(w ?? 0) * 604800 +
    Number(d ?? 0) * 86400 +
    Number(h ?? 0) * 3600 +
    Number(min ?? 0) * 60 +
    Math.floor(Number(s ?? 0))
  )
}

/** 75 -> "1:15", 3725 -> "1:02:05" */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** 9000 -> "2h 30m", 300 -> "5m" */
export function formatRuntime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.round((totalSec % 3600) / 60)
  if (h === 0) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

export function formatRelative(iso: string | undefined, now = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diffSec = (t - now) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(diffSec) >= size) return rtf.format(Math.round(diffSec / size), unit)
  }
  return 'just now'
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
export function formatCount(n: number | undefined): string {
  return n == null ? '' : compact.format(n)
}
