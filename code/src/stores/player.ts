import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Row } from '../types'
import { useLibrary } from './library'
import { useSettings } from './settings'

/** A local play queue — snapshot of the list order at the moment you hit play. */
export const usePlayer = defineStore('player', () => {
  const queue = ref<string[]>([])
  const index = ref(0)
  const open = ref(false)

  const currentId = computed(() => queue.value[index.value] ?? null)
  const hasNext = computed(() => index.value < queue.value.length - 1)
  const hasPrev = computed(() => index.value > 0)

  function playRows(rows: Row[], start = 0) {
    const playable = rows.filter((r) => r.video && !r.video.unavailable)
    if (!playable.length) return
    const startId = rows[start]?.item.videoId
    queue.value = playable.map((r) => r.item.videoId)
    index.value = Math.max(0, queue.value.indexOf(startId ?? ''))
    open.value = true
  }
  function jump(i: number) {
    if (i >= 0 && i < queue.value.length) index.value = i
  }
  const next = () => jump(index.value + 1)
  const prev = () => jump(index.value - 1)

  function close() {
    open.value = false
    queue.value = []
    index.value = 0
  }

  /** Called by the player when a video finishes. */
  function ended() {
    const lib = useLibrary()
    if (currentId.value) void lib.setWatched(currentId.value, true)
    if (useSettings().prefs.autoplayNext && hasNext.value) next()
  }

  return { queue, index, open, currentId, hasNext, hasPrev, playRows, jump, next, prev, close, ended }
})
