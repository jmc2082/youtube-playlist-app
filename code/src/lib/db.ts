import Dexie, { type EntityTable } from 'dexie'
import type { Source, Video } from '../types'

export interface WatchedRow {
  videoId: string
  watchedAt: number
}

/** Local cache — everything lives in the browser's IndexedDB. */
export const db = new Dexie('tubesort') as Dexie & {
  videos: EntityTable<Video, 'id'>
  sources: EntityTable<Source, 'id'>
  watched: EntityTable<WatchedRow, 'videoId'>
}

db.version(1).stores({
  videos: 'id',
  sources: 'id, kind',
  watched: 'videoId',
})

/** Dexie can't store Vue proxies; strip reactivity before writing. */
export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
