import { ref, watch, type Ref } from 'vue'

/**
 * A ref mirrored into localStorage. For plain objects, saved values are merged
 * over `initial` so newly added settings still get their defaults.
 */
export function useStored<T>(key: string, initial: T): Ref<T> {
  let start = initial
  try {
    const raw = localStorage.getItem(key)
    if (raw != null) {
      const saved = JSON.parse(raw) as T
      const isObj = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v)
      start = isObj(initial) && isObj(saved) ? ({ ...initial, ...saved } as T) : saved
    }
  } catch {
    /* ignore corrupt values */
  }
  const r = ref(start) as Ref<T>
  watch(r, (v) => localStorage.setItem(key, JSON.stringify(v)), { deep: true })
  return r
}
