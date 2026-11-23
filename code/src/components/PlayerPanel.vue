<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from './Icon.vue'
import CommentsSection from './CommentsSection.vue'
import { formatCount, formatDuration, formatRuntime } from '../lib/format'
import { loadYouTubeIframeApi } from '../composables/youtubeIframe'
import { useLibrary } from '../stores/library'
import { usePlayer } from '../stores/player'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'

const player = usePlayer()
const library = useLibrary()
const settings = useSettings()
const ui = useUi()

const host = ref<HTMLElement | null>(null)
const wide = () => window.matchMedia('(min-width: 1280px)').matches
const upNextOpen = ref(wide())
const commentsOpen = computed({
  get: () => settings.prefs.commentsOpen,
  set: (v) => (settings.prefs.commentsOpen = v),
})
// Below 1280px the player is pinned on top, so only one section opens at a time.
if (!wide() && commentsOpen.value) upNextOpen.value = false
function toggleUpNext() {
  upNextOpen.value = !upNextOpen.value
  if (upNextOpen.value && !wide()) commentsOpen.value = false
}
function toggleComments() {
  commentsOpen.value = !commentsOpen.value
  if (commentsOpen.value && !wide()) upNextOpen.value = false
}
const titleAt = (i: number) => {
  const id = player.queue[i]
  return id ? library.videos.get(id)?.title ?? '' : ''
}
const prevTitle = computed(() => titleAt(player.index - 1))
const nextTitle = computed(() => titleAt(player.index + 1))

// Shift+N / Shift+P like YouTube. Only works while focus is on this page —
// clicks inside the video iframe give keyboard focus to YouTube's player.
function onKey(e: KeyboardEvent) {
  if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
  const k = e.key.toLowerCase()
  if (k === 'n' && player.hasNext) player.next()
  else if (k === 'p' && player.hasPrev) player.prev()
  else return
  e.preventDefault()
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const mq = window.matchMedia('(min-width: 1280px)')
const onResize = () => {
  if (!mq.matches && upNextOpen.value && commentsOpen.value) upNextOpen.value = false
}
mq.addEventListener('change', onResize)
onBeforeUnmount(() => mq.removeEventListener('change', onResize))

function seek(seconds: number) {
  yt?.seekTo(seconds, true)
  yt?.playVideo()
}
const queueEl = ref<HTMLElement | null>(null)
let yt: YT.Player | null = null
let poll: number | undefined

const current = computed(() => (player.currentId ? library.videos.get(player.currentId) : undefined))
const remaining = computed(() =>
  player.queue.slice(player.index + 1).reduce((t, id) => t + (library.videos.get(id)?.durationSec ?? 0), 0),
)

onMounted(async () => {
  try {
    const YTApi = await loadYouTubeIframeApi()
    if (!host.value) return
    // Uses youtube.com (not youtube-nocookie.com) so plays can count toward
    // your history when you're signed into YouTube in this browser.
    yt = new YTApi.Player(host.value, {
      videoId: player.currentId ?? undefined,
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, origin: location.origin },
      events: {
        onStateChange: (e) => {
          if (e.data === YTApi.PlayerState.ENDED) player.ended()
        },
        onError: () => {
          ui.toast('This video can’t be played here — skipping.', 'error')
          if (player.hasNext) player.next()
        },
      },
    })
    // Mark as watched once you're 90% through, even if you skip the outro.
    poll = window.setInterval(() => {
      const id = player.currentId
      if (!yt?.getDuration || !id || library.isWatched(id)) return
      const d = yt.getDuration()
      if (d > 0 && yt.getCurrentTime() / d >= 0.9) void library.setWatched(id, true)
    }, 4000)
  } catch (e) {
    ui.error(e)
  }
})

watch(
  () => player.currentId,
  async (id) => {
    if (id && yt?.loadVideoById) yt.loadVideoById(id)
    await nextTick()
    queueEl.value?.querySelector('.q.on')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
)

onBeforeUnmount(() => {
  clearInterval(poll)
  yt?.destroy()
})
</script>

<template>
  <section class="player-panel">
    <div class="frame">
      <div ref="host" />
    </div>

    <div class="now">
      <div class="title-row">
        <div class="t">
          <h2>{{ current?.title ?? 'Loading…' }}</h2>
          <p class="muted">{{ current?.channelTitle }}</p>
        </div>
        <button class="btn ghost sm icon" aria-label="Close player" @click="player.close"><Icon name="x" /></button>
      </div>

      <div class="controls">
        <div class="skip" role="group" aria-label="Skip videos">
          <button
            class="btn skip-btn"
            :disabled="!player.hasPrev"
            :title="prevTitle ? `Previous: ${prevTitle} (Shift+P)` : 'No previous video'"
            aria-label="Previous video"
            @click="player.prev"
          >
            <Icon name="prev" :size="15" /><span class="lbl">Previous</span>
          </button>
          <button
            class="btn skip-btn"
            :disabled="!player.hasNext"
            :title="nextTitle ? `Next: ${nextTitle} (Shift+N)` : 'End of the queue'"
            aria-label="Next video"
            @click="player.next"
          >
            <span class="lbl">Next</span><Icon name="next" :size="15" />
          </button>
        </div>
        <span class="pos faint">{{ player.index + 1 }} / {{ player.queue.length }}</span>
        <label class="toggle">
          <input v-model="settings.prefs.autoplayNext" type="checkbox" />
          <span class="sw" />
          Autoplay
        </label>
        <button
          v-if="player.currentId"
          class="btn sm"
          :class="{ ok: library.isWatched(player.currentId) }"
          @click="library.setWatched(player.currentId!, !library.isWatched(player.currentId!))"
        >
          <Icon name="check" :size="14" />{{ library.isWatched(player.currentId) ? 'Watched' : 'Mark watched' }}
        </button>
      </div>
    </div>

    <div class="sections">
      <div class="sec" :class="{ open: upNextOpen }">
        <button class="sec-head" :aria-expanded="upNextOpen" @click="toggleUpNext">
          <span>Up next <span class="faint">· {{ player.queue.length - player.index - 1 }} videos · {{ formatRuntime(remaining) }}</span></span>
          <Icon :name="upNextOpen ? 'asc' : 'desc'" :size="15" />
        </button>
        <ol v-if="upNextOpen" ref="queueEl" class="queue sec-body">
          <li v-for="(id, i) in player.queue" :key="id">
            <button class="q" :class="{ on: i === player.index, done: library.isWatched(id) }" @click="player.jump(i)">
              <span class="n">{{ i === player.index ? '▶' : i + 1 }}</span>
              <img :src="library.videos.get(id)?.thumbnail" alt="" loading="lazy" referrerpolicy="no-referrer" />
              <span class="qt">
                <span class="qtitle">{{ library.videos.get(id)?.title }}</span>
                <span class="faint">{{ formatDuration(library.videos.get(id)?.durationSec ?? 0) }}</span>
              </span>
            </button>
          </li>
        </ol>
      </div>

      <div class="sec" :class="{ open: commentsOpen }">
        <button class="sec-head" :aria-expanded="commentsOpen" @click="toggleComments">
          <span>Comments<span v-if="current?.commentCount != null" class="faint"> · {{ formatCount(current.commentCount) }}</span></span>
          <Icon :name="commentsOpen ? 'asc' : 'desc'" :size="15" />
        </button>
        <div v-if="commentsOpen && player.currentId" class="sec-body">
          <CommentsSection :video-id="player.currentId" :channel-id="current?.channelId" @seek="seek" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.player-panel {
  display: flex; flex-direction: column; min-height: 0;
  background: rgba(11, 11, 18, .92); backdrop-filter: blur(16px);
}
.frame { position: relative; aspect-ratio: 16 / 9; background: #000; flex: none; }
.frame :deep(iframe), .frame > div { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }

.now { padding: 14px 16px 10px; }
.title-row { display: flex; gap: 8px; align-items: flex-start; }
.t { flex: 1; min-width: 0; }
h2 {
  margin: 0; font-size: 16px; line-height: 1.3; letter-spacing: -.01em;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.t p { margin: 2px 0 0; font-size: 13px; }
.controls { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.skip { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; padding: 3px; gap: 2px; }
.skip-btn { height: 32px; padding: 0 14px; border: 0; background: transparent; }
.skip-btn:hover:not(:disabled) { background: var(--panel-2); }
.skip-btn:not(:disabled) :deep(svg) { color: var(--accent); }
.pos { font-variant-numeric: tabular-nums; font-size: 12px; margin-right: auto; }
.btn.ok { background: rgba(52, 211, 153, .18); border-color: rgba(52, 211, 153, .5); color: #a7f3d0; }

.toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--text-2); cursor: pointer; }
.toggle input { position: absolute; opacity: 0; }
.sw { width: 32px; height: 18px; border-radius: 99px; background: rgba(255, 255, 255, .14); position: relative; transition: background .2s; }
.sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .2s; }
.toggle input:checked + .sw { background: var(--accent-2); }
.toggle input:checked + .sw::after { transform: translateX(14px); }
.toggle input:focus-visible + .sw { outline: 2px solid var(--accent-2); outline-offset: 2px; }

.sections { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.sec { display: flex; flex-direction: column; min-height: 0; border-top: 1px solid var(--border); }
.sec-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; flex: none;
  padding: 11px 16px; border: 0; background: none; cursor: pointer;
  font-weight: 700; font-size: 13px; text-align: left;
}
.sec-head:hover { background: var(--panel); }
.sec-body { overflow-y: auto; max-height: 38vh; overscroll-behavior: contain; }
.queue { list-style: none; margin: 0; padding: 4px 8px 12px; }
.q {
  width: 100%; display: flex; align-items: center; gap: 10px; padding: 6px 8px; border: 0; background: none;
  border-radius: 10px; cursor: pointer; text-align: left;
}
.q:hover { background: var(--panel); }
.q.on { background: rgba(255, 61, 110, .14); }
.q.done:not(.on) { opacity: .5; }
.n { width: 22px; text-align: center; font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; flex: none; }
.q.on .n { color: var(--accent); }
.q img { width: 72px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 6px; flex: none; background: var(--panel-2); }
.qt { display: flex; flex-direction: column; min-width: 0; font-size: 12.5px; }
.qtitle { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }

/* Docked right column: open sections share the remaining height. */
@media (min-width: 1280px) {
  .sec.open { flex: 1 1 0; }
  .sec.open .sec-body { flex: 1; max-height: none; }
}
/* Phones: keep the pinned player compact. */
@media (max-width: 600px) {
  .now { padding: 10px 12px 8px; }
  .t p { display: none; }
  h2 { font-size: 14px; -webkit-line-clamp: 1; line-clamp: 1; }
  .controls { margin-top: 8px; }
  .skip-btn { padding: 0 12px; }
  .sec-body { max-height: 34vh; }
}
@media (max-width: 1279px) {
  .player-panel { border-bottom: 1px solid var(--border); box-shadow: 0 16px 30px -20px #000; }
}
@media (min-width: 700px) and (max-width: 1279px) {
  /* Tablet: video beside its controls to save vertical space. */
  .player-panel { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); }
  .frame { grid-row: span 2; }
  .sec-body { max-height: 240px; }
}
</style>
