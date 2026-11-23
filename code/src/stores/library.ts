import { defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'
import { db, plain } from '../lib/db'
import { inBucket, planReorder, sortRows } from '../lib/sort'
import type { ImportEntry } from '../lib/takeout'
import * as yt from '../services/youtube'
import type { DurationBucket, Row, SortDir, SortKey, Source, Video } from '../types'
import { useAuth } from './auth'
import { useQuota } from './quota'
import { STARTER_PLAYLISTS, useSettings } from './settings'
import { useUi } from './ui'

export const useLibrary = defineStore('library', () => {
  const auth = useAuth()
  const ui = useUi()
  const quota = useQuota()
  const settings = useSettings()

  // ---------- state ----------
  const sources = ref<Source[]>([])
  /** shallowRef + manual trigger: thousands of videos without deep reactivity cost. */
  const videos = shallowRef(new Map<string, Video>())
  const watched = shallowRef(new Map<string, number>())
  const activeId = ref<string | null>(null)
  const loading = ref(false)
  const ready = ref(false)

  // view state
  const sortKey = ref<SortKey>(settings.prefs.defaultSortKey)
  const sortDir = ref<SortDir>(settings.prefs.defaultSortDir)
  const search = ref('')
  const bucket = ref<DurationBucket>('all')

  // ---------- derived ----------
  const active = computed(() => sources.value.find((s) => s.id === activeId.value) ?? null)
  /** Every playlist on the account (used by Settings and the "add to playlist" picker). */
  const allPlaylists = computed(() => sources.value.filter((s) => s.kind !== 'import'))
  /** Only the playlists you chose to show in the sidebar. */
  const playlists = computed(() => {
    const shown = settings.prefs.shownPlaylists
    if (settings.prefs.showAllPlaylists || !shown) return allPlaylists.value
    const order = new Map(shown.map((id, i) => [id, i]))
    return allPlaylists.value
      .filter((s) => order.has(s.id))
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
  })
  const imports = computed(() => sources.value.filter((s) => s.kind === 'import'))
  const writablePlaylists = computed(() => sources.value.filter((s) => s.kind === 'playlist' && s.editable))

  const allRows = computed<Row[]>(() => {
    const items = active.value?.items ?? []
    const map = videos.value
    return items.map((item) => ({ item, video: map.get(item.videoId) }))
  })

  /** Full list in the chosen order, ignoring filters (used for "save order"). */
  const sortedRows = computed(() => sortRows(allRows.value, sortKey.value, sortDir.value))

  const filtersActive = computed(
    () => !!search.value.trim() || bucket.value !== 'all' || settings.prefs.hideWatched,
  )

  const visibleRows = computed(() => {
    const q = search.value.trim().toLowerCase()
    const w = watched.value
    return sortedRows.value.filter(({ item, video }) => {
      if (settings.prefs.hideWatched && w.has(item.videoId)) return false
      if (bucket.value !== 'all' && (!video || !inBucket(video.durationSec, bucket.value))) return false
      if (q && !(video && (video.title.toLowerCase().includes(q) || video.channelTitle.toLowerCase().includes(q))))
        return false
      return true
    })
  })

  const stats = computed(() => {
    const rows = visibleRows.value
    let runtime = 0
    let seen = 0
    for (const r of rows) {
      runtime += r.video?.durationSec ?? 0
      if (watched.value.has(r.item.videoId)) seen++
    }
    return { count: rows.length, total: allRows.value.length, runtime, watched: seen }
  })

  // ---------- persistence helpers ----------
  async function persistSource(s: Source) {
    await db.sources.put(plain(s))
  }
  function upsertSource(s: Source) {
    const i = sources.value.findIndex((x) => x.id === s.id)
    if (i === -1) sources.value.push(s)
    else sources.value[i] = s
    return persistSource(s)
  }
  function putVideos(list: Video[]) {
    const m = videos.value
    for (const v of list) m.set(v.id, v)
    triggerRef(videos)
    return db.videos.bulkPut(list)
  }

  async function withBusy<T>(label: string, total: number, fn: (tick: (done: number) => void) => Promise<T>) {
    ui.busy = { label, done: 0, total }
    try {
      return await fn((done) => {
        if (ui.busy) ui.busy = { ...ui.busy, done }
      })
    } finally {
      ui.busy = null
    }
  }

  // ---------- lifecycle ----------
  async function init() {
    const [s, v, w] = await Promise.all([db.sources.toArray(), db.videos.toArray(), db.watched.toArray()])
    sources.value = s
    videos.value = new Map(v.map((x) => [x.id, x]))
    watched.value = new Map(w.map((x) => [x.videoId, x.watchedAt]))
    ready.value = true

    await auth.restore()
    if (auth.signedIn) await refreshPlaylists().catch(ui.error)

    const pool = [...playlists.value, ...imports.value]
    const first = pool.find((x) => x.items?.length) ?? pool[0]
    if (first) await select(first.id)
  }

  /** Pulls your playlist list (not their contents) from YouTube. */
  async function refreshPlaylists() {
    if (!auth.signedIn) return
    const list = await yt.listMyPlaylists()
    const existing = new Map(sources.value.map((s) => [s.id, s]))
    const next: Source[] = []

    const likesId = auth.channel?.likesPlaylistId
    if (likesId) {
      const prev = existing.get(`pl:${likesId}`)
      next.push({
        id: `pl:${likesId}`, kind: 'liked', title: 'Liked videos', playlistId: likesId,
        itemCount: prev?.itemCount ?? 0, editable: false, items: prev?.items ?? null, fetchedAt: prev?.fetchedAt,
      })
    }
    for (const p of list) {
      const prev = existing.get(`pl:${p.id}`)
      const unchanged = prev && prev.itemCount === p.itemCount
      next.push({
        id: `pl:${p.id}`, kind: 'playlist', title: p.title, playlistId: p.id, thumbnail: p.thumbnail,
        itemCount: p.itemCount, editable: true,
        // Keep cached items if the count didn't change; otherwise refetch on open.
        items: unchanged ? prev.items : null, fetchedAt: unchanged ? prev.fetchedAt : undefined,
      })
    }

    const keepImports = sources.value.filter((s) => s.kind === 'import')
    const stale = sources.value.filter((s) => s.kind !== 'import' && !next.some((n) => n.id === s.id))
    sources.value = [...next, ...keepImports]
    await db.transaction('rw', db.sources, async () => {
      await db.sources.bulkDelete(stale.map((s) => s.id))
      await db.sources.bulkPut(plain(next))
    })
    if (activeId.value && !sources.value.some((s) => s.id === activeId.value)) activeId.value = null
    seedShownPlaylists(next)
  }

  /** First run: pick the starter playlists by name, then remember them by id. */
  function seedShownPlaylists(list: Source[]) {
    if (settings.prefs.shownPlaylists !== null) return
    const norm = (t: string) => t.trim().toLowerCase()
    const ids: string[] = []
    const missing: string[] = []
    for (const name of STARTER_PLAYLISTS) {
      const hit = list.find((s) => s.kind === 'playlist' && norm(s.title) === norm(name))
      if (hit) ids.push(hit.id)
      else missing.push(name)
    }
    if (!ids.length) return // nothing matched — keep showing everything until set up in Settings
    settings.prefs.shownPlaylists = ids
    if (missing.length)
      ui.toast(`Couldn’t find: ${missing.map((m) => `“${m}”`).join(', ')}. Pick playlists in Settings.`, 'info', 9000)
  }

  function toggleShown(id: string, on: boolean) {
    const cur = settings.prefs.shownPlaylists ?? []
    settings.prefs.shownPlaylists = on ? [...cur.filter((x) => x !== id), id] : cur.filter((x) => x !== id)
  }

  /** On sign-out: drop YouTube-sourced lists, keep imports and the video cache. */
  async function forgetAccount() {
    const gone = sources.value.filter((s) => s.kind !== 'import').map((s) => s.id)
    sources.value = sources.value.filter((s) => s.kind === 'import')
    await db.sources.bulkDelete(gone)
    if (activeId.value && gone.includes(activeId.value)) activeId.value = sources.value[0]?.id ?? null
  }

  async function select(id: string) {
    activeId.value = id
    sortKey.value = settings.prefs.defaultSortKey
    sortDir.value = settings.prefs.defaultSortDir
    search.value = ''
    bucket.value = 'all'
    ui.sidebarOpen = false
    const s = active.value
    if (!s) return
    // Imports pasted as plain links have no "date added" — fall back gracefully.
    if (sortKey.value === 'added' && s.items && !s.items.some((i) => i.addedAt)) sortKey.value = 'original'
    try {
      if (s.items === null) await loadItems(s)
      else await ensureVideos(s.items.map((i) => i.videoId))
    } catch (e) {
      ui.error(e)
    }
  }

  async function loadItems(s: Source) {
    if (!s.playlistId) return
    loading.value = true
    try {
      const items = await withBusy(`Loading “${s.title}”`, s.itemCount, (tick) =>
        yt.listPlaylistItems(s.playlistId!, tick),
      )
      await upsertSource({ ...s, items, itemCount: items.length, fetchedAt: Date.now() })
      await ensureVideos(items.map((i) => i.videoId), true)
    } finally {
      loading.value = false
    }
  }

  /** Fetches details for any ids not yet cached (or all, with force). */
  async function ensureVideos(ids: string[], force = false) {
    const missing = force ? [...new Set(ids)] : [...new Set(ids)].filter((id) => !videos.value.has(id))
    if (!missing.length) return
    if (!auth.signedIn && !auth.hasApiKey) return
    await withBusy('Fetching video details', missing.length, async (tick) => {
      const list = await yt.getVideos(missing, tick)
      await putVideos(list)
    })
  }

  async function refreshActive() {
    const s = active.value
    if (!s) return
    try {
      if (s.playlistId) await loadItems(s)
      else await ensureVideos(s.items?.map((i) => i.videoId) ?? [], true)
      ui.toast('Refreshed', 'success')
    } catch (e) {
      ui.error(e)
    }
  }

  // ---------- imports ----------
  async function importList(title: string, entries: ImportEntry[]) {
    const s: Source = {
      id: `import:${Date.now()}`, kind: 'import', title, editable: false, itemCount: entries.length,
      items: entries.map((e, position) => ({ videoId: e.videoId, addedAt: e.addedAt, position })),
      fetchedAt: Date.now(),
    }
    await upsertSource(s)
    await select(s.id)
    if (!auth.signedIn && !auth.hasApiKey)
      ui.toast('Imported. Sign in (or add an API key) to load titles and lengths.', 'info', 8000)
    else ui.toast(`Imported ${entries.length} videos`, 'success')
  }

  async function deleteSource(id: string) {
    const s = sources.value.find((x) => x.id === id)
    if (!s || s.kind !== 'import') return
    const ok = await ui.confirm({
      title: 'Delete this import?',
      message: `“${s.title}” will be removed from TubeSort. Nothing on YouTube changes.`,
      confirmLabel: 'Delete', danger: true,
    })
    if (!ok) return
    sources.value = sources.value.filter((x) => x.id !== id)
    await db.sources.delete(id)
    if (activeId.value === id) activeId.value = sources.value[0]?.id ?? null
  }

  // ---------- watched ----------
  async function setWatched(videoId: string, value: boolean) {
    const m = watched.value
    if (value) {
      const t = Date.now()
      m.set(videoId, t)
      await db.watched.put({ videoId, watchedAt: t })
    } else {
      m.delete(videoId)
      await db.watched.delete(videoId)
    }
    triggerRef(watched)
  }
  const isWatched = (videoId: string) => watched.value.has(videoId)

  // ---------- writes to YouTube ----------
  async function confirmCost(action: string, ops: number): Promise<boolean> {
    const units = ops * yt.COST.write
    const over = units > quota.remaining
    return ui.confirm({
      title: action,
      message:
        `This makes ${ops} change${ops === 1 ? '' : 's'} on YouTube, using about ${units.toLocaleString()} ` +
        `of your ~${quota.remaining.toLocaleString()} remaining daily API units.` +
        (over ? '\n\n⚠️ That is more than what’s left today — it will stop partway and you can resume tomorrow.' : ''),
      confirmLabel: 'Go ahead',
    })
  }

  function invalidate(playlistId: string, deltaCount = 0) {
    const s = sources.value.find((x) => x.playlistId === playlistId)
    if (s) void upsertSource({ ...s, items: null, itemCount: s.itemCount + deltaCount })
  }

  async function createPlaylist(title: string) {
    const p = await yt.createPlaylist(title)
    await upsertSource({
      id: `pl:${p.id}`, kind: 'playlist', title: p.title, playlistId: p.id,
      itemCount: 0, editable: true, items: [], fetchedAt: Date.now(),
    })
    return p.id
  }

  async function addToPlaylist(videoIds: string[], title = 'Add to playlist') {
    if (!auth.signedIn) return ui.toast('Sign in to save to YouTube playlists.', 'error')
    const target = await ui.pickPlaylist(title, active.value?.playlistId)
    if (!target) return
    const targetSrc = sources.value.find((s) => s.playlistId === target)
    const already = new Set(targetSrc?.items?.map((i) => i.videoId) ?? [])
    const todo = videoIds.filter((id) => !already.has(id))
    if (!todo.length) return ui.toast('Those videos are already in that playlist.')
    if (todo.length > 1 && !(await confirmCost(`Copy ${todo.length} videos to “${targetSrc?.title}”?`, todo.length)))
      return

    let done = 0
    try {
      await withBusy('Saving to YouTube', todo.length, async (tick) => {
        for (const id of todo) {
          await yt.insertPlaylistItem(target, id)
          tick(++done)
        }
      })
      ui.toast(`Added ${done} video${done === 1 ? '' : 's'} to “${targetSrc?.title}”`, 'success')
    } catch (e) {
      ui.error(e)
      if (done) ui.toast(`${done} of ${todo.length} were added before the error.`)
    } finally {
      if (done) invalidate(target, done)
    }
  }

  async function removeFromPlaylist(row: Row) {
    const s = active.value
    if (!s?.editable || !s.playlistId || !row.item.playlistItemId) return
    const ok = await ui.confirm({
      title: 'Remove from playlist?',
      message: `“${row.video?.title ?? row.item.videoId}” will be removed from “${s.title}” on YouTube.`,
      confirmLabel: 'Remove', danger: true,
    })
    if (!ok) return
    try {
      await yt.deletePlaylistItem(row.item.playlistItemId)
      const items = s.items!
        .filter((i) => i.playlistItemId !== row.item.playlistItemId)
        .map((i, position) => ({ ...i, position }))
      await upsertSource({ ...s, items, itemCount: items.length })
      ui.toast('Removed', 'success')
    } catch (e) {
      ui.error(e)
    }
  }

  /** Watched videos in the open playlist that can be removed on YouTube. */
  const removableWatched = computed(() => {
    const s = active.value
    if (!s?.editable || !s.items) return []
    return s.items.filter((i) => i.playlistItemId && watched.value.has(i.videoId))
  })

  async function removeWatchedFromPlaylist() {
    const s = active.value
    const todo = removableWatched.value
    if (!s?.playlistId || !todo.length) return
    const n = todo.length
    const ok = await ui.confirm({
      title: `Remove ${n} watched video${n === 1 ? '' : 's'}?`,
      message:
        `They’ll be removed from “${s.title}” on YouTube (including any hidden by filters). ` +
        `This uses about ${(n * yt.COST.write).toLocaleString()} of your ~${quota.remaining.toLocaleString()} remaining daily API units.`,
      confirmLabel: 'Remove watched', danger: true,
    })
    if (!ok) return

    const removed = new Set<string>()
    try {
      await withBusy('Removing watched videos', n, async (tick) => {
        for (const item of todo) {
          await yt.deletePlaylistItem(item.playlistItemId!)
          removed.add(item.playlistItemId!)
          tick(removed.size)
        }
      })
      ui.toast(`Removed ${removed.size} watched video${removed.size === 1 ? '' : 's'}`, 'success')
    } catch (e) {
      ui.error(e)
      if (removed.size) ui.toast(`${removed.size} of ${n} were removed before the error.`)
    } finally {
      if (removed.size) {
        const cur = sources.value.find((x) => x.id === s.id) ?? s
        const items = (cur.items ?? [])
          .filter((i) => !removed.has(i.playlistItemId!))
          .map((i, position) => ({ ...i, position }))
        await upsertSource({ ...cur, items, itemCount: items.length })
      }
    }
  }

  /** Rewrites the YouTube playlist so it matches the current sort. */
  async function saveOrderToYouTube() {
    const s = active.value
    if (!s?.editable || !s.playlistId || !s.items) return
    const current = [...s.items].sort((a, b) => a.position - b.position).map((i) => i.playlistItemId!)
    const desired = sortedRows.value.map((r) => r.item.playlistItemId!)
    const ops = planReorder(current, desired)
    if (!ops.length) return ui.toast('YouTube already has this order.', 'success')
    if (!(await confirmCost(`Save this order to “${s.title}”?`, ops.length))) return

    const byId = new Map(s.items.map((i) => [i.playlistItemId!, i]))
    let done = 0
    try {
      await withBusy('Reordering on YouTube', ops.length, async (tick) => {
        for (const op of ops) {
          await yt.movePlaylistItem(op.id, s.playlistId!, byId.get(op.id)!.videoId, op.position)
          tick(++done)
        }
      })
      const items = desired.map((id, position) => ({ ...byId.get(id)!, position }))
      await upsertSource({ ...s, items })
      sortKey.value = 'original'
      sortDir.value = 'asc'
      ui.toast('Playlist order saved to YouTube', 'success')
    } catch (e) {
      ui.error(e)
      if (done) await loadItems(s).catch(() => {})
    }
  }

  return {
    // state
    sources, videos, watched, activeId, loading, ready, sortKey, sortDir, search, bucket,
    // getters
    active, playlists, allPlaylists, imports, removableWatched, writablePlaylists, allRows, sortedRows, visibleRows, stats, filtersActive,
    // actions
    init, refreshPlaylists, forgetAccount, select, refreshActive, ensureVideos, importList, deleteSource,
    setWatched, isWatched, createPlaylist, addToPlaylist, removeFromPlaylist, removeWatchedFromPlaylist, toggleShown, saveOrderToYouTube,
  }
})
