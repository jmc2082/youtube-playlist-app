import { parseIsoDuration } from '../lib/format'
import type { SourceItem, Video } from '../types'
import { API_KEY } from './auth'

const BASE = 'https://www.googleapis.com/youtube/v3'

/** Quota costs (units) — https://developers.google.com/youtube/v3/determine_quota_cost */
export const COST = { read: 1, write: 50 } as const

export class YouTubeError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason?: string,
  ) {
    super(message)
  }
}

interface Hooks {
  /** Returns a valid access token, or null if the user isn't signed in. */
  getToken: () => Promise<string | null>
  onQuota: (units: number) => void
}

let hooks: Hooks = { getToken: async () => null, onQuota: () => {} }
export function configureYouTube(h: Hooks) {
  hooks = h
}

type Params = Record<string, string | number | boolean | undefined>

async function call<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  params: Params,
  body?: unknown,
  /**
   * allowKey: fall back to the API key when not signed in.
   * preferKey: use the API key even when signed in — for public data whose
   *   endpoints demand a broader OAuth scope than we ask for (comments).
   */
  opts: { allowKey?: boolean; preferKey?: boolean } = {},
): Promise<T> {
  const url = new URL(`${BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v))

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.preferKey && API_KEY) {
    url.searchParams.set('key', API_KEY)
  } else {
    const token = await hooks.getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    else if ((opts.allowKey || opts.preferKey) && API_KEY) url.searchParams.set('key', API_KEY)
    else throw new YouTubeError('Please sign in with Google first.', 401)
  }
  if (body) headers['Content-Type'] = 'application/json'

  hooks.onQuota(method === 'GET' ? COST.read : COST.write)
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = json?.error
    // Google puts the precise cause in error.details[].reason (ErrorInfo), e.g.
    // API_KEY_HTTP_REFERRER_BLOCKED; fall back to the legacy errors[].reason.
    const info = (err?.details as any[] | undefined)?.find((d) => String(d?.['@type']).endsWith('ErrorInfo'))
    const reason: string | undefined = info?.reason ?? err?.errors?.[0]?.reason
    throw new YouTubeError(friendly(reason, err?.message ?? res.statusText), res.status, reason)
  }
  return json as T
}

function friendly(reason: string | undefined, fallback: string): string {
  switch (reason) {
    case 'quotaExceeded':
      return 'Daily YouTube API quota is used up. It resets at midnight Pacific time.'
    case 'manualSortRequired':
      return 'This playlist is set to auto-sort on YouTube. Switch it to "Manual" in YouTube playlist settings first.'
    case 'API_KEY_HTTP_REFERRER_BLOCKED':
      return `Your API key doesn’t allow this website. In Google Cloud → Credentials → your API key → Website restrictions, add ${location.origin}/*`
    case 'API_KEY_SERVICE_BLOCKED':
      return 'Your API key isn’t allowed to call the YouTube Data API. In Google Cloud → Credentials → your API key → API restrictions, add “YouTube Data API v3”.'
    case 'API_KEY_INVALID':
      return 'The API key is invalid. Check VITE_YOUTUBE_API_KEY (in Amplify: environment variables, then redeploy).'
    case 'SERVICE_DISABLED':
      return 'YouTube Data API v3 isn’t enabled for the API key’s Google Cloud project. Enable it under APIs & Services → Library.'
    case 'insufficientPermissions':
    case 'ACCESS_TOKEN_SCOPE_INSUFFICIENT':
      return 'This needs a YouTube API key — set VITE_YOUTUBE_API_KEY in code/.env and restart the dev server.'
    case 'commentsDisabled':
      return 'Comments are turned off for this video.'
    case 'playlistItemsNotAccessible':
    case 'playlistNotFound':
      return 'That playlist is not accessible.'
    default:
      return reason ? `${fallback} (${reason})` : fallback
  }
}

interface Page<T> {
  items: T[]
  nextPageToken?: string
  pageInfo?: { totalResults: number }
}

async function paginate<T>(path: string, params: Params, onPage?: (n: number) => void): Promise<T[]> {
  const all: T[] = []
  let pageToken: string | undefined
  do {
    const page = await call<Page<T>>('GET', path, { ...params, maxResults: 50, pageToken })
    all.push(...(page.items ?? []))
    onPage?.(all.length)
    pageToken = page.nextPageToken
  } while (pageToken)
  return all
}

// ---------- Reads ----------

type Thumbs = Record<string, { url: string } | undefined>
const bestThumb = (t: Thumbs | undefined) =>
  t?.maxres?.url ?? t?.standard?.url ?? t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? ''

export interface ChannelInfo {
  title: string
  thumbnail: string
  likesPlaylistId?: string
}

export async function getMyChannel(): Promise<ChannelInfo | null> {
  const r = await call<Page<any>>('GET', 'channels', { part: 'snippet,contentDetails', mine: true })
  const c = r.items?.[0]
  if (!c) return null
  return {
    title: c.snippet.title,
    thumbnail: c.snippet.thumbnails?.default?.url ?? '',
    likesPlaylistId: c.contentDetails?.relatedPlaylists?.likes || undefined,
  }
}

export interface PlaylistInfo {
  id: string
  title: string
  thumbnail: string
  itemCount: number
}

export async function listMyPlaylists(): Promise<PlaylistInfo[]> {
  const items = await paginate<any>('playlists', { part: 'snippet,contentDetails', mine: true })
  return items.map((p) => ({
    id: p.id,
    title: p.snippet.title,
    thumbnail: p.snippet.thumbnails?.medium?.url ?? p.snippet.thumbnails?.default?.url ?? '',
    itemCount: p.contentDetails?.itemCount ?? 0,
  }))
}

/** Note: YouTube returns nothing for "WL" (Watch Later) and "HL" (History). */
export async function listPlaylistItems(
  playlistId: string,
  onProgress?: (n: number) => void,
): Promise<SourceItem[]> {
  const items = await paginate<any>('playlistItems', { part: 'snippet,contentDetails', playlistId }, onProgress)
  return items.map((it, i) => ({
    playlistItemId: it.id,
    videoId: it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId,
    position: it.snippet?.position ?? i,
    // For playlistItems, snippet.publishedAt is when it was added to the playlist.
    addedAt: it.snippet?.publishedAt,
  }))
}

/** Fetches details in batches of 50 (1 unit per batch). Missing ids come back as unavailable. */
export async function getVideos(ids: string[], onProgress?: (n: number) => void): Promise<Video[]> {
  const out: Video[] = []
  const now = Date.now()
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const r = await call<Page<any>>(
      'GET',
      'videos',
      { part: 'snippet,contentDetails,statistics', id: batch.join(','), maxResults: 50 },
      undefined,
      { allowKey: true },
    )
    const found = new Map<string, any>((r.items ?? []).map((v) => [v.id, v]))
    for (const id of batch) {
      const v = found.get(id)
      out.push(
        v
          ? {
              id,
              title: v.snippet.title,
              channelTitle: v.snippet.channelTitle,
              channelId: v.snippet.channelId,
              thumbnail: bestThumb(v.snippet.thumbnails),
              durationSec: parseIsoDuration(v.contentDetails?.duration),
              publishedAt: v.snippet.publishedAt,
              viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : undefined,
              commentCount: v.statistics?.commentCount ? Number(v.statistics.commentCount) : undefined,
              liveBroadcastContent: v.snippet.liveBroadcastContent ?? 'none',
              fetchedAt: now,
            }
          : {
              id,
              title: 'Unavailable video',
              channelTitle: '',
              channelId: '',
              thumbnail: '',
              durationSec: 0,
              publishedAt: '',
              liveBroadcastContent: 'none',
              unavailable: true,
              fetchedAt: now,
            },
      )
    }
    onProgress?.(Math.min(i + 50, ids.length))
  }
  return out
}

// ---------- Comments (1 unit per page) ----------

export interface Comment {
  id: string
  author: string
  authorAvatar: string
  authorChannelId?: string
  authorUrl?: string
  text: string
  likeCount: number
  publishedAt: string
  edited: boolean
  replyCount: number
  /** Replies included with the thread (YouTube sends up to 5). */
  replies: Comment[]
}

function toComment(c: any, replyCount = 0, replies: Comment[] = []): Comment {
  const s = c.snippet
  return {
    id: c.id,
    author: s.authorDisplayName ?? '',
    authorAvatar: s.authorProfileImageUrl ?? '',
    authorChannelId: s.authorChannelId?.value,
    authorUrl: s.authorChannelUrl,
    text: s.textOriginal ?? s.textDisplay ?? '',
    likeCount: s.likeCount ?? 0,
    publishedAt: s.publishedAt,
    edited: !!s.updatedAt && s.updatedAt !== s.publishedAt,
    replyCount,
    replies,
  }
}

export async function getCommentThreads(
  videoId: string,
  order: 'relevance' | 'time',
  pageToken?: string,
): Promise<{ items: Comment[]; nextPageToken?: string }> {
  const r = await call<Page<any>>(
    'GET',
    'commentThreads',
    { part: 'snippet,replies', videoId, order, maxResults: 50, textFormat: 'plainText', pageToken },
    undefined,
    { preferKey: true },
  )
  return {
    nextPageToken: r.nextPageToken,
    items: (r.items ?? []).map((t) =>
      toComment(
        t.snippet.topLevelComment,
        t.snippet.totalReplyCount ?? 0,
        // API returns included replies newest-first; show them oldest-first like YouTube.
        (t.replies?.comments ?? []).map((c: any) => toComment(c)).reverse(),
      ),
    ),
  }
}

/** All replies for a thread (first 100). */
export async function getReplies(parentId: string): Promise<Comment[]> {
  const r = await call<Page<any>>(
    'GET',
    'comments',
    { part: 'snippet', parentId, maxResults: 100, textFormat: 'plainText' },
    undefined,
    { preferKey: true },
  )
  return (r.items ?? []).map((c) => toComment(c))
}

// ---------- Writes (50 units each) ----------

export async function insertPlaylistItem(playlistId: string, videoId: string): Promise<string> {
  const r = await call<{ id: string }>('POST', 'playlistItems', { part: 'snippet' }, {
    snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
  })
  return r.id
}

export async function deletePlaylistItem(playlistItemId: string): Promise<void> {
  await call('DELETE', 'playlistItems', { id: playlistItemId })
}

export async function movePlaylistItem(
  playlistItemId: string,
  playlistId: string,
  videoId: string,
  position: number,
): Promise<void> {
  await call('PUT', 'playlistItems', { part: 'snippet' }, {
    id: playlistItemId,
    snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId }, position },
  })
}

export async function createPlaylist(title: string): Promise<PlaylistInfo> {
  const r = await call<any>('POST', 'playlists', { part: 'snippet,status' }, {
    snippet: { title },
    status: { privacyStatus: 'private' },
  })
  return { id: r.id, title: r.snippet.title, thumbnail: '', itemCount: 0 }
}
