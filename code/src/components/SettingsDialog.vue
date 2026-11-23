<script setup lang="ts">
import { SORT_OPTIONS } from '../lib/sort'
import { db } from '../lib/db'
import { computed, ref } from 'vue'
import { useAuth } from '../stores/auth'
import { useLibrary } from '../stores/library'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'

const settings = useSettings()
const ui = useUi()
const auth = useAuth()
const library = useLibrary()

const plFilter = ref('')
const shownSet = computed(() => new Set(settings.prefs.shownPlaylists ?? library.allPlaylists.map((p) => p.id)))
const plOptions = computed(() =>
  [...library.allPlaylists]
    .filter((p) => p.title.toLowerCase().includes(plFilter.value.toLowerCase()))
    // chosen ones first, then alphabetical
    .sort((a, b) => Number(shownSet.value.has(b.id)) - Number(shownSet.value.has(a.id)) || a.title.localeCompare(b.title)),
)
function toggle(id: string, on: boolean) {
  if (settings.prefs.shownPlaylists === null) settings.prefs.shownPlaylists = [...shownSet.value]
  library.toggleShown(id, on)
}

async function clearWatched() {
  const ok = await ui.confirm({
    title: 'Clear watched history?',
    message: 'Removes TubeSort’s local “watched” marks. Your YouTube history is not affected.',
    confirmLabel: 'Clear', danger: true,
  })
  if (!ok) return
  await db.watched.clear()
  location.reload()
}
async function resetCache() {
  const ok = await ui.confirm({
    title: 'Reset local data?',
    message: 'Deletes cached playlists, video details, imports and watched marks from this browser. Nothing on YouTube changes.',
    confirmLabel: 'Reset everything', danger: true,
  })
  if (!ok) return
  await db.delete()
  location.reload()
}
</script>

<template>
  <div class="overlay" @click.self="ui.settingsOpen = false" @keydown.esc="ui.settingsOpen = false">
    <div class="modal">
      <h2>Settings</h2>

      <div class="group">
        <span class="label">Default sort when a list opens</span>
        <div class="row">
          <select v-model="settings.prefs.defaultSortKey" class="input">
            <option v-for="o in SORT_OPTIONS" :key="o.key" :value="o.key">{{ o.label }}</option>
          </select>
          <select v-model="settings.prefs.defaultSortDir" class="input">
            <option value="asc">{{ SORT_OPTIONS.find((o) => o.key === settings.prefs.defaultSortKey)?.asc }}</option>
            <option value="desc">{{ SORT_OPTIONS.find((o) => o.key === settings.prefs.defaultSortKey)?.desc }}</option>
          </select>
        </div>
      </div>

      <div v-if="auth.signedIn && library.allPlaylists.length" class="group">
        <span class="label">Playlists in the sidebar</span>
        <label class="check tight">
          <input v-model="settings.prefs.showAllPlaylists" type="checkbox" /> Show all {{ library.allPlaylists.length }} playlists
        </label>
        <template v-if="!settings.prefs.showAllPlaylists">
          <input v-if="library.allPlaylists.length > 8" v-model="plFilter" class="input" placeholder="Filter playlists" />
          <div class="pl-list">
            <label v-for="p in plOptions" :key="p.id" class="check tight">
              <input type="checkbox" :checked="shownSet.has(p.id)" @change="toggle(p.id, ($event.target as HTMLInputElement).checked)" />
              <span class="pl-name">{{ p.title }}</span>
              <span class="faint">{{ p.itemCount }}</span>
            </label>
          </div>
        </template>
      </div>

      <label class="check"><input v-model="settings.prefs.autoplayNext" type="checkbox" /> Autoplay the next video</label>
      <label class="check"><input v-model="settings.prefs.hideWatched" type="checkbox" /> Hide videos I’ve watched</label>

      <div class="group">
        <span class="label">Local data</span>
        <div class="row">
          <button class="btn sm" @click="clearWatched">Clear watched marks</button>
          <button class="btn sm danger" @click="resetCache">Reset all local data</button>
        </div>
      </div>

      <p class="faint note">
        About watch history: videos play through YouTube’s official embedded player. If you’re signed into YouTube in
        this same browser, plays usually show up in your YouTube history too — but YouTube doesn’t guarantee it.
      </p>

      <div class="actions"><button class="btn primary" @click="ui.settingsOpen = false">Done</button></div>
    </div>
  </div>
</template>

<style scoped>
.group { margin-top: 18px; display: flex; flex-direction: column; gap: 8px; }
.label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--text-3); }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
.row select { flex: 1; min-width: 150px; appearance: auto; }
.row select option { background: var(--panel-solid); }
.check { display: flex; align-items: center; gap: 10px; margin-top: 14px; cursor: pointer; }
.check input { width: 16px; height: 16px; accent-color: var(--accent-2); }
.check.tight { margin-top: 0; }
.pl-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 4px 2px; }
.pl-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note { font-size: 12.5px; margin: 20px 0 0; }
</style>
