export interface ImportEntry {
  videoId: string
  addedAt?: string
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Pull an 11-char video id out of a URL or bare id. */
export function extractVideoId(input: string): string | null {
  const s = input.trim().replace(/^"|"$/g, '')
  if (ID_RE.test(s)) return s
  const m =
    /(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/.exec(s)
  return m ? m[1]! : null
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

/**
 * Parses either:
 *  - a Google Takeout playlist CSV (e.g. "Watch later-videos.csv"), whose
 *    header row starts with "Video ID" and whose 2nd column is when it was added
 *  - or any free text containing YouTube URLs / ids, one per line.
 * Duplicates are dropped, keeping the first occurrence.
 */
export function parseImport(text: string): ImportEntry[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const seen = new Set<string>()
  const out: ImportEntry[] = []
  const push = (e: ImportEntry) => {
    if (seen.has(e.videoId)) return
    seen.add(e.videoId)
    out.push(e)
  }

  const headerIdx = lines.findIndex((l) => /^"?video id"?\s*,/i.test(l))
  if (headerIdx !== -1) {
    for (const line of lines.slice(headerIdx + 1)) {
      const [id, added] = splitCsvLine(line)
      const videoId = id ? extractVideoId(id) : null
      if (!videoId) continue
      const t = added ? Date.parse(added) : NaN
      push({ videoId, addedAt: Number.isNaN(t) ? undefined : new Date(t).toISOString() })
    }
    return out
  }

  for (const line of lines) {
    const tokens = line.split(/[\s,]+/).filter(Boolean)
    for (const token of tokens) {
      // Bare 11-char ids only count when they're alone on a line — otherwise
      // ordinary words like "programming" would look like ids.
      const videoId =
        tokens.length === 1 || !ID_RE.test(token) ? extractVideoId(token) : null
      if (videoId) push({ videoId })
    }
  }
  return out
}
