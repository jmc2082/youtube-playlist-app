export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'time'; text: string; seconds: number }
  | { kind: 'link'; text: string; href: string }

// 1:23, 12:34, 1:02:03 — minutes/seconds parts must be < 60.
const TOKEN = /(https?:\/\/[^\s<>"]+)|\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/g

/** Splits comment text into plain text, clickable timestamps and links. */
export function tokenizeComment(text: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index!
    if (i > last) out.push({ kind: 'text', text: text.slice(last, i) })
    if (m[1]) {
      // Don't swallow trailing punctuation into the link.
      const href = m[1].replace(/[).,!?:;]+$/, '')
      out.push({ kind: 'link', text: href, href })
      last = i + href.length
      continue
    }
    const [, , h, mm, ss] = m
    out.push({ kind: 'time', text: m[0], seconds: Number(h ?? 0) * 3600 + Number(mm) * 60 + Number(ss) })
    last = i + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  // Merge adjacent text pieces (can happen after link trimming).
  return out.reduce<Segment[]>((acc, s) => {
    const prev = acc[acc.length - 1]
    if (s.kind === 'text' && prev?.kind === 'text') prev.text += s.text
    else acc.push(s)
    return acc
  }, [])
}
