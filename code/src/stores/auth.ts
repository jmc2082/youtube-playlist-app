import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { CLIENT_ID, API_KEY, requestToken, revokeToken, type Token } from '../services/auth'
import { getMyChannel, type ChannelInfo } from '../services/youtube'

const TOKEN_KEY = 'tubesort:token'

export const useAuth = defineStore('auth', () => {
  const token = ref<Token | null>(readToken())
  const channel = ref<ChannelInfo | null>(null)
  const configured = !!CLIENT_ID
  const hasApiKey = !!API_KEY

  const signedIn = computed(() => !!token.value)

  function readToken(): Token | null {
    try {
      const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as Token | null
      return t && t.expiresAt > Date.now() ? t : null
    } catch {
      return null
    }
  }
  function save(t: Token | null) {
    token.value = t
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t))
    else sessionStorage.removeItem(TOKEN_KEY)
  }

  async function signIn() {
    save(await requestToken('select_account'))
    channel.value = await getMyChannel()
  }

  /** Returns a usable token, silently refreshing it if it expired (may show a brief popup). */
  let refreshing: Promise<Token> | null = null
  async function getToken(): Promise<string | null> {
    if (!token.value) return null
    if (token.value.expiresAt > Date.now()) return token.value.accessToken
    refreshing ??= requestToken('').finally(() => (refreshing = null))
    try {
      save(await refreshing)
      return token.value!.accessToken
    } catch {
      save(null)
      return null
    }
  }

  async function restore() {
    if (token.value && !channel.value) {
      try {
        channel.value = await getMyChannel()
      } catch {
        save(null)
      }
    }
  }

  function signOut() {
    if (token.value) revokeToken(token.value.accessToken)
    save(null)
    channel.value = null
  }

  return { token, channel, configured, hasApiKey, signedIn, signIn, signOut, getToken, restore }
})
