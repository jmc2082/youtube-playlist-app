<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './Icon.vue'
import SortToolbar from './SortToolbar.vue'
import VideoCard from './VideoCard.vue'
import WelcomeHero from './WelcomeHero.vue'
import { formatRelative, formatRuntime } from '../lib/format'
import { useLibrary } from '../stores/library'
import { usePlayer } from '../stores/player'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'

const library = useLibrary()
const player = usePlayer()
const settings = useSettings()
const ui = useUi()

// Render incrementally so 2,000-video playlists stay snappy.
const PAGE = 90
const limit = ref(PAGE)
const shown = computed(() => library.visibleRows.slice(0, limit.value))
watch(() => [library.activeId, library.sortKey, library.sortDir, library.search, library.bucket], () => (limit.value = PAGE))

const sentinel = ref<HTMLElement | null>(null)
const io = new IntersectionObserver((e) => {
  if (e[0]?.isIntersecting) limit.value += PAGE
}, { rootMargin: '800px' })
watch(sentinel, (el, old) => {
  if (old) io.unobserve(old)
  if (el) io.observe(el)
})
onBeforeUnmount(() => io.disconnect())

const s = computed(() => library.active)
const kindLabel = computed(() =>
  s.value?.kind === 'liked' ? 'Liked videos' : s.value?.kind === 'import' ? 'Imported list' : 'YouTube playlist',
)
const missingDetails = computed(() => library.allRows.some((r) => !r.video))
const canSaveOrder = computed(() => !!s.value?.editable && library.sortKey !== 'original' && !!s.value.items?.length)

function playAll(startIndex = 0) {
  player.playRows(library.visibleRows, startIndex)
}
function copyAll() {
  const ids = library.visibleRows.filter((r) => r.video && !r.video.unavailable).map((r) => r.item.videoId)
  library.addToPlaylist(ids, `Copy ${ids.length} videos to…`)
}
</script>

<template>
  <section class="lib">
    <WelcomeHero v-if="!s" />

    <template v-else>
      <div class="hero">
        <div class="hero-text">
          <span class="kind">{{ kindLabel }}</span>
          <h1>{{ s.title }}</h1>
          <p class="muted stats">
            <span><strong>{{ library.stats.count }}</strong>{{ library.stats.count !== library.stats.total ? ` of ${library.stats.total}` : '' }} videos</span>
            <span v-if="library.stats.runtime"><Icon name="clock" :size="14" /> {{ formatRuntime(library.stats.runtime) }}</span>
            <span v-if="library.stats.watched"><Icon name="check" :size="14" /> {{ library.stats.watched }} watched</span>
            <span v-if="s.fetchedAt" class="faint">synced {{ formatRelative(new Date(s.fetchedAt).toISOString()) }}</span>
          </p>
        </div>
        <div class="hero-actions">
          <button class="btn primary" :disabled="!library.visibleRows.length" @click="playAll()">
            <Icon name="play" :size="16" />Play all
          </button>
          <button v-if="canSaveOrder" class="btn" title="Rewrite the playlist on YouTube in this order" @click="library.saveOrderToYouTube">
            <Icon name="save" />Save order to YouTube
          </button>
          <button
            v-if="library.removableWatched.length"
            class="btn danger"
            title="Remove every video you've watched from this playlist on YouTube"
            @click="library.removeWatchedFromPlaylist"
          >
            <Icon name="trash" />Remove watched ({{ library.removableWatched.length }})
          </button>
          <button v-if="library.writablePlaylists.length" class="btn" title="Copy the visible videos into one of your playlists" @click="copyAll">
            <Icon name="copy" /><span class="hide-sm">Copy to playlist</span>
          </button>
          <button class="btn icon" title="Refresh from YouTube" @click="library.refreshActive"><Icon name="refresh" /></button>
        </div>
      </div>

      <SortToolbar />

      <div v-if="missingDetails && !library.loading && !ui.busy" class="notice card">
        <Icon name="sparkles" />
        <span>Some videos don’t have details yet. Sign in (or set an API key) to load titles and lengths so sorting works.</span>
      </div>

      <div v-if="library.loading && !library.allRows.length" class="videos" :class="`as-${settings.prefs.viewMode}`">
        <div v-for="n in 12" :key="n" class="ske"><div class="skeleton" style="aspect-ratio:16/9" /><div class="skeleton" style="height:14px;width:80%;margin-top:10px" /></div>
      </div>

      <div v-else-if="!library.visibleRows.length" class="empty">
        <Icon name="search" :size="28" />
        <p v-if="library.allRows.length">No videos match these filters.</p>
        <p v-else>This list is empty.</p>
      </div>

      <div v-else class="videos" :class="`as-${settings.prefs.viewMode}`">
        <VideoCard
          v-for="(row, i) in shown"
          :key="row.item.playlistItemId ?? row.item.videoId"
          :row="row"
          :index="i"
          :playing="player.open && player.currentId === row.item.videoId"
          @play="playAll(i)"
        />
      </div>
      <div v-if="shown.length < library.visibleRows.length" ref="sentinel" class="more faint">Loading more…</div>
    </template>
  </section>
</template>

<style scoped>
.lib { padding: 24px clamp(14px, 3vw, 32px) 64px; min-width: 0; }
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; margin-bottom: 18px; }
.kind { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }
h1 { margin: 4px 0 6px; font-size: clamp(24px, 3.2vw, 34px); letter-spacing: -.025em; line-height: 1.1; word-break: break-word; }
.stats { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; }
.stats span { display: inline-flex; align-items: center; gap: 5px; }
.stats strong { color: var(--text); }
.hero-actions { display: flex; flex-wrap: wrap; gap: 8px; }

.notice { display: flex; gap: 10px; align-items: center; padding: 12px 14px; margin: 0 0 16px; color: var(--text-2); border-color: rgba(34, 211, 238, .3); }

.videos.as-grid { display: grid; gap: 22px 18px; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
.videos.as-list { display: flex; flex-direction: column; gap: 4px; }
.empty { display: grid; place-items: center; gap: 4px; padding: 64px 0; color: var(--text-3); text-align: center; }
.more { text-align: center; padding: 24px; }

@media (max-width: 600px) {
  .lib { padding-top: 16px; }
  .hero-actions { width: 100%; }
  .hero-actions .btn.primary { flex: 1; }
  .hide-sm { display: none; }
  .videos.as-grid { grid-template-columns: 1fr; gap: 18px; }
}
@media (min-width: 601px) and (max-width: 900px) {
  .videos.as-grid { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
}
</style>
