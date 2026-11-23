import { describe, expect, it } from 'vitest'
import { formatDuration, parseIsoDuration } from '../format'
import { planReorder, sortRows } from '../sort'
import { extractVideoId, parseImport } from '../takeout'
import type { Row } from '../../types'

describe('parseIsoDuration', () => {
  it.each([
    ['PT45S', 45],
    ['PT4M5S', 245],
    ['PT2H', 7200],
    ['PT1H2M3S', 3723],
    ['P1DT1H', 90000],
    ['P0D', 0],
    ['garbage', 0],
  ])('%s → %i', (iso, sec) => expect(parseIsoDuration(iso)).toBe(sec))
})

describe('formatDuration', () => {
  it('formats', () => {
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(245)).toBe('4:05')
    expect(formatDuration(3723)).toBe('1:02:03')
  })
})

const row = (id: string, position: number, durationSec?: number, publishedAt = '2020-01-01T00:00:00Z'): Row => ({
  item: { videoId: id, position },
  video:
    durationSec === undefined
      ? undefined
      : { id, title: id, channelTitle: 'c', channelId: 'c', thumbnail: '', durationSec, publishedAt, liveBroadcastContent: 'none', fetchedAt: 0 },
})

describe('sortRows', () => {
  const rows = [row('long', 0, 7200), row('missing', 1), row('short', 2, 30), row('mid', 3, 600)]
  it('shortest first, unknowns last', () => {
    expect(sortRows(rows, 'duration', 'asc').map((r) => r.item.videoId)).toEqual(['short', 'mid', 'long', 'missing'])
  })
  it('longest first keeps unknowns last', () => {
    expect(sortRows(rows, 'duration', 'desc').map((r) => r.item.videoId)).toEqual(['long', 'mid', 'short', 'missing'])
  })
  it('by publish date', () => {
    const r = [row('a', 0, 1, '2024-05-01T00:00:00Z'), row('b', 1, 1, '2021-01-01T00:00:00Z')]
    expect(sortRows(r, 'published', 'desc').map((x) => x.item.videoId)).toEqual(['a', 'b'])
    expect(sortRows(r, 'published', 'asc').map((x) => x.item.videoId)).toEqual(['b', 'a'])
  })
  it('ties fall back to playlist position', () => {
    const r = [row('x', 0, 60), row('y', 1, 60)]
    expect(sortRows(r, 'duration', 'desc').map((x) => x.item.videoId)).toEqual(['x', 'y'])
  })
})

describe('planReorder', () => {
  const apply = (cur: string[], ops: { id: string; position: number }[]) => {
    const s = cur.slice()
    for (const op of ops) {
      s.splice(s.indexOf(op.id), 1)
      s.splice(op.position, 0, op.id)
    }
    return s
  }
  it('produces the desired order', () => {
    const cur = ['a', 'b', 'c', 'd', 'e']
    const want = ['e', 'c', 'a', 'd', 'b']
    expect(apply(cur, planReorder(cur, want))).toEqual(want)
  })
  it('no ops when already sorted', () => {
    expect(planReorder(['a', 'b'], ['a', 'b'])).toEqual([])
  })
  it('one op when a single item moves to the front', () => {
    expect(planReorder(['a', 'b', 'c', 'd'], ['d', 'a', 'b', 'c'])).toHaveLength(1)
  })
})

describe('import parsing', () => {
  it('extracts ids from many URL shapes', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1s',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'dQw4w9WgXcQ',
    ])
      expect(extractVideoId(u)).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://example.com')).toBeNull()
  })

  it('parses a Takeout CSV with added timestamps', () => {
    const csv = 'Video ID,Playlist Video Creation Timestamp\ndQw4w9WgXcQ,2024-03-01T12:00:00+00:00\n9bZkp7q19f0,2023-01-01T00:00:00+00:00\ndQw4w9WgXcQ,2024-03-01T12:00:00+00:00\n'
    expect(parseImport(csv)).toEqual([
      { videoId: 'dQw4w9WgXcQ', addedAt: '2024-03-01T12:00:00.000Z' },
      { videoId: '9bZkp7q19f0', addedAt: '2023-01-01T00:00:00.000Z' },
    ])
  })

  it('parses the older Takeout format with a metadata block', () => {
    const csv = 'Playlist ID,Channel ID,Time Created,Title\nWL,UCx,2015,Watch later\n\nVideo ID,Time Added\ndQw4w9WgXcQ,2019-01-01 10:00:00 UTC\n'
    expect(parseImport(csv).map((e) => e.videoId)).toEqual(['dQw4w9WgXcQ'])
  })

  it('pasted free text ignores ordinary 11-letter words', () => {
    const text = 'check out this programming talk https://youtu.be/dQw4w9WgXcQ\n9bZkp7q19f0'
    expect(parseImport(text).map((e) => e.videoId)).toEqual(['dQw4w9WgXcQ', '9bZkp7q19f0'])
  })
})

import { tokenizeComment } from '../commentText'

describe('tokenizeComment', () => {
  it('finds timestamps', () => {
    const s = tokenizeComment('best part 1:02:03 and 4:05.')
    expect(s.filter((x) => x.kind === 'time').map((x) => (x as { seconds: number }).seconds)).toEqual([3723, 245])
    expect(s.map((x) => x.text).join('')).toBe('best part 1:02:03 and 4:05.')
  })
  it('ignores invalid times and ratios', () => {
    expect(tokenizeComment('score 3:75 today').every((x) => x.kind === 'text')).toBe(true)
  })
  it('links URLs without trailing punctuation', () => {
    const s = tokenizeComment('see https://example.com/a?b=1).')
    expect(s.find((x) => x.kind === 'link')).toMatchObject({ href: 'https://example.com/a?b=1' })
    expect(s.map((x) => x.text).join('')).toBe('see https://example.com/a?b=1).')
  })
})
