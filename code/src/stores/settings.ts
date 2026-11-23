import { defineStore } from 'pinia'
import { useStored } from '../composables/useStored'
import type { SortDir, SortKey, ViewMode } from '../types'

/**
 * Playlists shown in the sidebar the first time you sign in, matched by name
 * (case-insensitive). After that they're remembered by ID — edit in Settings.
 */
export const STARTER_PLAYLISTS = [
  'JM Short Watch Later List',
  'Construction Equipment Tutorials',
  'Solar',
  'Farming and Plants',
]

export const useSettings = defineStore('settings', () => {
  const prefs = useStored('tubesort:prefs', {
    /** Applied whenever you open a list. */
    defaultSortKey: 'duration' as SortKey,
    defaultSortDir: 'asc' as SortDir,
    viewMode: 'grid' as ViewMode,
    autoplayNext: true,
    hideWatched: false,
    /** Source ids (`pl:<playlistId>`) shown in the sidebar. null = not set up yet. */
    shownPlaylists: null as string[] | null,
    showAllPlaylists: false,
    commentsOpen: false,
    commentOrder: 'relevance' as 'relevance' | 'time',
  })
  return { prefs }
})
