<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import { DURATION_BUCKETS, SORT_OPTIONS } from '../lib/sort'
import { useLibrary } from '../stores/library'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'
import { usePlayer } from '../stores/player'

const library = useLibrary()
const settings = useSettings()
const ui = useUi()
const player = usePlayer()

const opt = computed(() => SORT_OPTIONS.find((o) => o.key === library.sortKey)!)
const options = computed(() =>
  SORT_OPTIONS.filter((o) => o.key !== 'added' || library.active?.items?.some((i) => i.addedAt)),
)
const isDefault = computed(
  () => settings.prefs.defaultSortKey === library.sortKey && settings.prefs.defaultSortDir === library.sortDir,
)

function flip() {
  library.sortDir = library.sortDir === 'asc' ? 'desc' : 'asc'
}
function makeDefault() {
  settings.prefs.defaultSortKey = library.sortKey
  settings.prefs.defaultSortDir = library.sortDir
  ui.toast(`Default sort: ${opt.value.label} · ${library.sortDir === 'asc' ? opt.value.asc : opt.value.desc}`, 'success')
}
</script>

<template>
  <div class="toolbar" :class="{ 'player-open': player.open }">
    <div class="row">
      <div class="sort">
        <label class="select">
          <Icon name="sort" :size="16" />
          <span class="sr-only">Sort by</span>
          <select v-model="library.sortKey">
            <option v-for="o in options" :key="o.key" :value="o.key">{{ o.label }}</option>
          </select>
        </label>
        <button class="btn sm dir" :title="'Reverse order'" @click="flip">
          <Icon :name="library.sortDir === 'asc' ? 'asc' : 'desc'" :size="15" />
          {{ library.sortDir === 'asc' ? opt.asc : opt.desc }}
        </button>
        <button v-if="!isDefault" class="btn ghost sm" title="Use this sort every time a list opens" @click="makeDefault">
          Make default
        </button>
      </div>

      <div class="right">
        <label class="search">
          <Icon name="search" :size="16" />
          <input v-model="library.search" class="input" type="search" placeholder="Search titles & channels" />
        </label>
        <button
          class="btn sm icon"
          :class="{ on: settings.prefs.hideWatched }"
          :title="settings.prefs.hideWatched ? 'Show watched videos' : 'Hide watched videos'"
          @click="settings.prefs.hideWatched = !settings.prefs.hideWatched"
        >
          <Icon :name="settings.prefs.hideWatched ? 'eyeoff' : 'eye'" :size="16" />
        </button>
        <div class="seg" role="group" aria-label="View">
          <button :class="{ on: settings.prefs.viewMode === 'grid' }" title="Grid" @click="settings.prefs.viewMode = 'grid'"><Icon name="grid" :size="15" /></button>
          <button :class="{ on: settings.prefs.viewMode === 'list' }" title="List" @click="settings.prefs.viewMode = 'list'"><Icon name="list" :size="15" /></button>
        </div>
      </div>
    </div>

    <div class="chips">
      <button
        v-for="b in DURATION_BUCKETS"
        :key="b.key"
        class="chip"
        :class="{ on: library.bucket === b.key }"
        @click="library.bucket = b.key"
      >
        {{ b.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  position: sticky; top: 0; z-index: 10;
  margin: 0 calc(-1 * clamp(14px, 3vw, 32px)) 18px; padding: 12px clamp(14px, 3vw, 32px);
  background: rgba(11, 11, 18, .82); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 10px;
}
.row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: space-between; }
.sort, .right { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.right { flex: 1; justify-content: flex-end; min-width: 0; }

.select {
  position: relative; display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 10px 0 12px; border-radius: 999px;
  background: var(--grad); font-weight: 700; font-size: 12.5px; cursor: pointer;
}
.select select {
  appearance: none; background: transparent; border: 0; font-weight: 700; padding-right: 14px; cursor: pointer; outline: none;
  background-image: linear-gradient(45deg, transparent 50%, #fff 50%), linear-gradient(135deg, #fff 50%, transparent 50%);
  background-position: right 4px center, right 0 center; background-size: 4px 4px; background-repeat: no-repeat;
}
.select select option { background: var(--panel-solid); color: var(--text); }
.select:focus-within { outline: 2px solid var(--accent-2); outline-offset: 2px; }

.search { position: relative; flex: 1; max-width: 320px; min-width: 140px; }
.search :deep(svg) { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); }
.search .input { width: 100%; height: 32px; padding-left: 34px; }
.btn.on { color: #fff; background: rgba(139, 92, 246, .25); border-color: rgba(139, 92, 246, .6); }

.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; padding: 2px; }
.seg button { width: 32px; height: 26px; border: 0; background: none; border-radius: 99px; cursor: pointer; color: var(--text-3); display: grid; place-items: center; }
.seg button.on { background: var(--panel-2); color: var(--text); }

.chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -2px; padding: 0 2px; }
.chips::-webkit-scrollbar { display: none; }

/* Player is pinned to the top on smaller screens — don't stack two sticky bars. */
@media (max-width: 1279px) { .toolbar.player-open { position: static; } }
@media (max-width: 600px) {
  .sort, .right { width: 100%; }
  .right { flex-wrap: nowrap; justify-content: stretch; }
  .search { max-width: none; min-width: 0; }
}
</style>
