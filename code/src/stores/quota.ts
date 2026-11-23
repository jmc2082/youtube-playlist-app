import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useStored } from '../composables/useStored'

export const DAILY_QUOTA = 10_000

/** Quota resets at midnight Pacific time. */
function pacificDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

/** Local *estimate* of today's YouTube Data API usage. */
export const useQuota = defineStore('quota', () => {
  const state = useStored('tubesort:quota', { day: pacificDay(), used: 0 })

  function roll() {
    const today = pacificDay()
    if (state.value.day !== today) state.value = { day: today, used: 0 }
  }
  function add(units: number) {
    roll()
    state.value.used += units
  }

  const used = computed(() => {
    roll()
    return state.value.used
  })
  const remaining = computed(() => Math.max(0, DAILY_QUOTA - used.value))
  const pct = computed(() => Math.min(100, (used.value / DAILY_QUOTA) * 100))

  return { used, remaining, pct, add }
})
