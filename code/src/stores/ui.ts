import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  text: string
}

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

export interface PickRequest {
  title: string
  excludeId?: string
  resolve: (playlistId: string | null) => void
}

export interface Busy {
  label: string
  done: number
  total: number
}

export const useUi = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const confirmReq = ref<ConfirmRequest | null>(null)
  const pickReq = ref<PickRequest | null>(null)
  const importOpen = ref(false)
  const settingsOpen = ref(false)
  const sidebarOpen = ref(false)
  const busy = ref<Busy | null>(null)
  let nextId = 1

  function toast(text: string, kind: Toast['kind'] = 'info', ms = 4500) {
    if (toasts.value.some((t) => t.text === text)) return
    const id = nextId++
    toasts.value.push({ id, kind, text })
    setTimeout(() => dismiss(id), ms)
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  function error(e: unknown) {
    toast(e instanceof Error ? e.message : String(e), 'error', 7000)
  }

  function confirm(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    return new Promise((resolve) => {
      confirmReq.value = { ...opts, resolve }
    })
  }
  function answerConfirm(ok: boolean) {
    confirmReq.value?.resolve(ok)
    confirmReq.value = null
  }

  function pickPlaylist(title: string, excludeId?: string): Promise<string | null> {
    return new Promise((resolve) => {
      pickReq.value = { title, excludeId, resolve }
    })
  }
  function answerPick(id: string | null) {
    pickReq.value?.resolve(id)
    pickReq.value = null
  }

  return {
    toasts, confirmReq, pickReq, importOpen, settingsOpen, sidebarOpen, busy,
    toast, dismiss, error, confirm, answerConfirm, pickPlaylist, answerPick,
  }
})
