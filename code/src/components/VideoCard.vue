<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { formatCount, formatDuration, formatRelative } from '../lib/format'
import { useLibrary } from '../stores/library'
import { useSettings } from '../stores/settings'
import type { Row } from '../types'

const props = defineProps<{ row: Row; index: number; playing: boolean }>()
defineEmits<{ play: [] }>()

const library = useLibrary()
const settings = useSettings()
const menu = ref(false)

const v = computed(() => props.row.video)
const id = computed(() => props.row.item.videoId)
const watched = computed(() => library.isWatched(id.value))
const playable = computed(() => !!v.value && !v.value.unavailable)
const badge = computed(() => {
  if (!v.value || v.value.unavailable) return ''
  if (v.value.liveBroadcastContent === 'live') return 'LIVE'
  if (v.value.liveBroadcastContent === 'upcoming') return 'SOON'
  return formatDuration(v.value.durationSec)
})
const tier = computed(() => {
  const d = v.value?.durationSec ?? 0
  return d < 300 ? 'short' : d < 1200 ? 'mid' : d < 3600 ? 'long' : 'epic'
})
const showAdded = computed(() => library.sortKey === 'added' && props.row.item.addedAt)
const canRemove = computed(() => !!library.active?.editable && !!props.row.item.playlistItemId)

function act(fn: () => unknown) {
  menu.value = false
  fn()
}
</script>

<template>
  <article
    class="card-v"
    :class="[settings.prefs.viewMode, { watched, playing, dead: v?.unavailable }]"
  >
    <span v-if="settings.prefs.viewMode === 'list'" class="idx faint">{{ index + 1 }}</span>

    <button class="thumb" :disabled="!playable" :aria-label="`Play ${v?.title ?? ''}`" @click="$emit('play')">
      <img v-if="v?.thumbnail" :src="v.thumbnail" alt="" loading="lazy" referrerpolicy="no-referrer" />
      <div v-else class="ph" :class="{ skeleton: !v }" />
      <span v-if="badge" class="dur" :class="tier">{{ badge }}</span>
      <span v-if="watched" class="seen"><Icon name="check" :size="13" />Watched</span>
      <span v-if="playing" class="now">Now playing</span>
      <span v-if="playable" class="hover-play"><Icon name="play" :size="22" /></span>
      <span v-if="watched" class="bar" />
    </button>

    <div class="info">
    <div class="body">
      <h3 :title="v?.title">{{ v?.title ?? id }}</h3>
      <p v-if="v && !v.unavailable" class="sub">
        <span class="chan">{{ v.channelTitle }}</span>
        <span class="faint">
          <template v-if="v.viewCount != null">{{ formatCount(v.viewCount) }} views · </template>{{ formatRelative(v.publishedAt) }}
          <template v-if="showAdded"> · added {{ formatRelative(row.item.addedAt) }}</template>
        </span>
      </p>
      <p v-else-if="v?.unavailable" class="sub faint">Deleted or private</p>
      <p v-else class="sub faint">Details not loaded</p>
    </div>

    <div class="more">
      <button class="btn ghost sm icon" aria-label="More actions" :aria-expanded="menu" @click="menu = !menu">
        <Icon name="more" />
      </button>
      <template v-if="menu">
        <div class="click-away" @click="menu = false" />
        <div class="menu card">
          <button @click="act(() => library.setWatched(id, !watched))">
            <Icon :name="watched ? 'eyeoff' : 'check'" :size="16" />{{ watched ? 'Mark as unwatched' : 'Mark as watched' }}
          </button>
          <button v-if="playable" @click="act(() => library.addToPlaylist([id]))"><Icon name="plus" :size="16" />Add to playlist…</button>
          <a :href="`https://www.youtube.com/watch?v=${id}`" target="_blank" rel="noopener" @click="menu = false">
            <Icon name="external" :size="16" />Open on YouTube
          </a>
          <button v-if="canRemove" class="danger" @click="act(() => library.removeFromPlaylist(row))">
            <Icon name="trash" :size="16" />Remove from playlist
          </button>
        </div>
      </template>
    </div>
    </div>
  </article>
</template>

<style scoped>
.card-v { position: relative; min-width: 0; }
.card-v.grid { display: flex; flex-direction: column; }
.card-v.list {
  display: grid; grid-template-columns: 34px 168px minmax(0, 1fr); align-items: center; gap: 14px;
  padding: 8px 6px; border-radius: 12px; transition: background .15s;
}
.card-v.list:hover { background: var(--panel); }
.idx { text-align: right; font-variant-numeric: tabular-nums; font-size: 12px; }

.thumb {
  position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; padding: 0; border: 0;
  border-radius: 12px; overflow: hidden; background: var(--panel-2); cursor: pointer;
  box-shadow: 0 10px 28px -16px rgba(0, 0, 0, .9);
  transition: transform .2s ease, box-shadow .2s ease;
}
.thumb:disabled { cursor: default; }
.thumb img, .ph { width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease, filter .2s; }
.card-v.grid:hover .thumb:not(:disabled) { transform: translateY(-3px); box-shadow: 0 18px 36px -16px rgba(255, 61, 110, .45); }
.card-v:hover .thumb img { transform: scale(1.04); }
.watched .thumb img { filter: saturate(.4) brightness(.6); }
.dead .thumb { opacity: .5; }

.dur {
  position: absolute; right: 8px; bottom: 8px; padding: 2px 7px; border-radius: 6px;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  background: rgba(0, 0, 0, .78); backdrop-filter: blur(4px);
}
.dur.short { box-shadow: inset 0 0 0 1px rgba(52, 211, 153, .6); color: #a7f3d0; }
.dur.epic { box-shadow: inset 0 0 0 1px rgba(255, 61, 110, .6); color: #fecdd3; }
.seen, .now {
  position: absolute; left: 8px; top: 8px; display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 700;
}
.seen { background: rgba(52, 211, 153, .9); color: #052e1c; }
.now { left: auto; right: 8px; background: var(--grad); }
.bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--accent); }
.hover-play {
  position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transition: opacity .2s;
  background: radial-gradient(circle, rgba(0, 0, 0, .45), transparent 70%);
}
.thumb:hover .hover-play, .thumb:focus-visible .hover-play { opacity: 1; }
.playing .thumb { outline: 2px solid var(--accent); outline-offset: 2px; }

.info { display: flex; align-items: flex-start; gap: 4px; min-width: 0; }
.grid .info { margin-top: 10px; }
.body { flex: 1; min-width: 0; }
h3 {
  margin: 0; font-size: 14.5px; font-weight: 650; line-height: 1.35; letter-spacing: -.005em;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.watched h3 { color: var(--text-2); }
.sub { margin: 4px 0 0; font-size: 12.5px; display: flex; flex-direction: column; }
.chan { color: var(--text-2); font-weight: 500; }

.more { position: relative; flex: none; margin: -4px -6px 0 0; }
.click-away { position: fixed; inset: 0; z-index: 30; }
.menu {
  position: absolute; right: 0; top: 36px; z-index: 31; min-width: 210px; padding: 6px;
  background: var(--panel-solid); box-shadow: var(--shadow); display: flex; flex-direction: column;
  animation: pop .14s ease-out;
}
.menu button, .menu a {
  display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 0; background: none;
  border-radius: 8px; cursor: pointer; text-align: left; color: var(--text); text-decoration: none; font-size: 13px;
}
.menu button:hover, .menu a:hover { background: var(--panel-2); }
.menu .danger { color: var(--danger); }

@media (max-width: 600px) {
  .card-v.list { grid-template-columns: 120px minmax(0, 1fr); gap: 10px; }
  .card-v.list .idx { display: none; }
  h3 { font-size: 14px; }
}
</style>
