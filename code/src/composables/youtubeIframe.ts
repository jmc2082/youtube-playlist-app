let apiPromise: Promise<typeof YT> | null = null

/** Loads the YouTube IFrame Player API once. */
export function loadYouTubeIframeApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise((resolve, reject) => {
    const w = window as unknown as { onYouTubeIframeAPIReady?: () => void }
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      apiPromise = null
      reject(new Error('Could not load the YouTube player.'))
    }
    document.head.appendChild(s)
  })
  return apiPromise
}
