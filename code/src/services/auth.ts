/**
 * Browser-only OAuth via Google Identity Services (token model).
 * No backend needed: we get a short-lived (1h) access token and ask again
 * when it expires. https://developers.google.com/identity/oauth2/web/guides/use-token-model
 */

export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
export const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY?.trim() ?? ''
export const SCOPE = 'https://www.googleapis.com/auth/youtube'

interface TokenResponse {
  access_token: string
  expires_in: number
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type: string; message?: string }) => void
          }): TokenClient
          revoke(token: string, done?: () => void): void
        }
      }
    }
  }
}

let gisPromise: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      gisPromise = null
      reject(new Error('Could not load Google sign-in. Check your connection or ad blocker.'))
    }
    document.head.appendChild(s)
  })
  return gisPromise
}

export interface Token {
  accessToken: string
  expiresAt: number
}

/** Opens the Google consent popup (or reuses consent silently with prompt: ''). */
export async function requestToken(prompt: '' | 'consent' | 'select_account' = ''): Promise<Token> {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set — see code/README.md.')
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.error) reject(new Error(r.error_description || r.error))
        else resolve({ accessToken: r.access_token, expiresAt: Date.now() + (r.expires_in - 60) * 1000 })
      },
      error_callback: (e) =>
        reject(new Error(e.type === 'popup_closed' ? 'Sign-in was cancelled.' : e.message || e.type)),
    })
    client.requestAccessToken({ prompt })
  })
}

export function revokeToken(token: string): void {
  window.google?.accounts.oauth2.revoke(token)
}
