import type { DurationBucket, Row, SortDir, SortKey } from '../types'

export const SORT_OPTIONS: { key: SortKey; label: string; asc: string; desc: string }[] = [
  { key: 'duration', label: 'Length', asc: 'Shortest first', desc: 'Longest first' },
  { key: 'published', label: 'Upload date', asc: 'Oldest first', desc: 'Newest first' },
  { key: 'added', label: 'Date added', asc: 'Oldest first', desc: 'Newest first' },
  { key: 'title', label: 'Title', asc: 'A → Z', desc: 'Z → A' },
  { key: 'channel', label: 'Channel', asc: 'A → Z', desc: 'Z → A' },
  { key: 'original', label: 'Playlist order', asc: 'As saved', desc: 'Reversed' },
]

export const DURATION_BUCKETS: { key: DurationBucket; label: string; min: number; max: number }[] = [
  { key: 'all', label: 'Any length', min: 0, max: Infinity },
  { key: 'short', label: '< 5 min', min: 0, max: 5 * 60 },
  { key: 'medium', label: '5–20 min', min: 5 * 60, max: 20 * 60 },
  { key: 'long', label: '20–60 min', min: 20 * 60, max: 60 * 60 },
  { key: 'epic', label: '1 hr +', min: 60 * 60, max: Infinity },
]

export function inBucket(durationSec: number, bucket: DurationBucket): boolean {
  const b = DURATION_BUCKETS.find((x) => x.key === bucket)!
  return durationSec >= b.min && durationSec < b.max
}

function time(iso: string | undefined): number | undefined {
  if (!iso) return undefined
  const t = Date.parse(iso)
  return Number.isNaN(t) ? undefined : t
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/**
 * Returns a sorted copy. Rows with missing data (unloaded / unavailable
 * videos) always sink to the bottom regardless of direction. Ties fall back
 * to the original playlist position so the sort is stable and predictable.
 */
export function sortRows(rows: Row[], key: SortKey, dir: SortDir): Row[] {
  const sign = dir === 'asc' ? 1 : -1

  const value = (r: Row): number | string | undefined => {
    const v = r.video
    switch (key) {
      case 'duration':
        return v && !v.unavailable ? v.durationSec : undefined
      case 'published':
        return v && !v.unavailable ? time(v.publishedAt) : undefined
      case 'added':
        return time(r.item.addedAt)
      case 'title':
        return v && !v.unavailable ? v.title : undefined
      case 'channel':
        return v && !v.unavailable ? v.channelTitle : undefined
      case 'original':
        return r.item.position
    }
  }

  return rows
    .map((r) => ({ r, k: value(r) }))
    .sort((a, b) => {
      if (a.k === undefined && b.k === undefined) return a.r.item.position - b.r.item.position
      if (a.k === undefined) return 1
      if (b.k === undefined) return -1
      const c =
        typeof a.k === 'string' && typeof b.k === 'string'
          ? collator.compare(a.k, b.k)
          : (a.k as number) - (b.k as number)
      return c !== 0 ? c * sign : a.r.item.position - b.r.item.position
    })
    .map((x) => x.r)
}

/**
 * Plans the minimum-ish set of `playlistItems.update(position)` calls to turn
 * `current` into `desired`. Each op moves one item to an index, shifting the
 * rest — the same semantics YouTube uses.
 */
export function planReorder(current: string[], desired: string[]): { id: string; position: number }[] {
  const sim = current.slice()
  const ops: { id: string; position: number }[] = []
  for (let i = 0; i < desired.length; i++) {
    const id = desired[i]!
    if (sim[i] === id) continue
    const j = sim.indexOf(id)
    if (j === -1) continue
    sim.splice(j, 1)
    sim.splice(i, 0, id)
    ops.push({ id, position: i })
  }
  return ops
}
