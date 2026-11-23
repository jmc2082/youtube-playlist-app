<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import SideBar from './components/SideBar.vue'
import LibraryView from './components/LibraryView.vue'
import PlayerPanel from './components/PlayerPanel.vue'
import ImportDialog from './components/ImportDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import PlaylistPicker from './components/PlaylistPicker.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import ToastStack from './components/ToastStack.vue'
import { configureYouTube } from './services/youtube'
import { useAuth } from './stores/auth'
import { useLibrary } from './stores/library'
import { usePlayer } from './stores/player'
import { useQuota } from './stores/quota'
import { useUi } from './stores/ui'

const auth = useAuth()
const quota = useQuota()
const library = useLibrary()
const player = usePlayer()
const ui = useUi()

configureYouTube({ getToken: auth.getToken, onQuota: quota.add })

onMounted(() => library.init().catch(ui.error))
</script>

<template>
  <div class="app" :class="{ 'with-player': player.open }">
    <AppHeader />
    <div class="shell">
      <div class="scrim" :class="{ show: ui.sidebarOpen }" @click="ui.sidebarOpen = false" />
      <SideBar class="sidebar" :class="{ open: ui.sidebarOpen }" />
      <main class="main">
        <PlayerPanel v-if="player.open" class="player" />
        <LibraryView />
      </main>
    </div>

    <div v-if="ui.busy" class="busy" role="status">
      <div class="busy-bar" :style="{ width: ui.busy.total ? `${(ui.busy.done / ui.busy.total) * 100}%` : '30%' }" />
    </div>

    <ImportDialog v-if="ui.importOpen" />
    <SettingsDialog v-if="ui.settingsOpen" />
    <PlaylistPicker v-if="ui.pickReq" />
    <ConfirmDialog v-if="ui.confirmReq" />
    <ToastStack />
  </div>
</template>

<style scoped>
.app { height: 100dvh; display: flex; flex-direction: column; }
.shell {
  flex: 1; min-height: 0;
  display: grid; grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
}
.main { min-width: 0; overflow-y: auto; overflow-x: hidden; }
.scrim { display: none; }

/* Wide screens: player docks as its own right column. */
@media (min-width: 1280px) {
  .with-player .main {
    display: grid; grid-template-columns: minmax(0, 1fr) var(--player-w);
    grid-template-areas: 'lib player'; align-items: start;
  }
  .with-player .player {
    grid-area: player; position: sticky; top: 0;
    height: calc(100dvh - var(--header-h)); border-left: 1px solid var(--border);
  }
}

/* Tablet & phone: sidebar becomes a drawer, player sticks to the top. */
@media (max-width: 959px) {
  .shell { grid-template-columns: minmax(0, 1fr); }
  .sidebar {
    position: fixed; z-index: 60; top: 0; bottom: 0; left: 0;
    width: min(var(--sidebar-w), 86vw);
    transform: translateX(-100%); transition: transform .25s ease;
    box-shadow: var(--shadow);
  }
  .sidebar.open { transform: none; }
  .scrim {
    display: block; position: fixed; inset: 0; z-index: 55; background: rgba(0, 0, 0, .55);
    opacity: 0; pointer-events: none; transition: opacity .2s;
  }
  .scrim.show { opacity: 1; pointer-events: auto; }
}
@media (max-width: 1279px) {
  .player { position: sticky; top: 0; z-index: 20; }
}

.busy { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 200; background: rgba(255,255,255,.05); }
.busy-bar { height: 100%; background: var(--grad); transition: width .2s; box-shadow: 0 0 12px var(--accent); }
</style>
