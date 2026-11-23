export interface Video {
  id: string
  title: string
  channelTitle: string
  channelId: string
  thumbnail: string
  durationSec: number
  /** When the video was uploaded/published on YouTube (ISO string). */
  publishedAt: string
  viewCount?: number
  commentCount?: number
  /** 'none' | 'live' | 'upcoming' */
  liveBroadcastContent: string
  /** True when the API returned nothing (deleted / private video). */
  unavailable?: boolean
  fetchedAt: number
}

export interface SourceItem {
  videoId: string
  /** Only present for real YouTube playlists — needed for update/delete. */
  playlistItemId?: string
  /** Position in the original list (0-based). */
  position: number
  /** When the video was added to the list (ISO string), if known. */
  addedAt?: string
}

export type SourceKind = 'playlist' | 'liked' | 'import'

export interface Source {
  id: string
  kind: SourceKind
  title: string
  playlistId?: string
  thumbnail?: string
  itemCount: number
  /** Whether we can write to it on YouTube (reorder / remove). */
  editable: boolean
  /** null = not fetched yet. */
  items: SourceItem[] | null
  fetchedAt?: number
}

export type SortKey = 'duration' | 'published' | 'added' | 'title' | 'channel' | 'original'
export type SortDir = 'asc' | 'desc'
export type DurationBucket = 'all' | 'short' | 'medium' | 'long' | 'epic'
export type ViewMode = 'grid' | 'list'

export interface Row {
  item: SourceItem
  video?: Video
}
