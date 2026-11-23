<script setup lang="ts">
import Icon from './Icon.vue'
import { useAuth } from '../stores/auth'
import { useLibrary } from '../stores/library'
import { useUi } from '../stores/ui'
import { signInAndSync } from '../composables/session'
import type { Source } from '../types'

const auth = useAuth()
const library = useLibrary()
const ui = useUi()

async function refresh() {
  try {
    await library.refreshPlaylists()
    ui.toast('Playlists updated', 'success')
  } catch (e) {
    ui.error(e)
  }
}

const icon = (s: Source) => (s.kind === 'liked' ? 'heart' : s.kind === 'import' ? 'file' : 'playlist')
</script>

<template>
  <aside class="side">
    <div class="side-head">
      <span class="label">Library</span>
      <button v-if="auth.signedIn" class="btn ghost sm icon" title="Refresh playlists" @click="refresh">
        <Icon name="refresh" :size="15" />
      </button>
      <button class="btn ghost sm icon close" aria-label="Close" @click="ui.sidebarOpen = false">
        <Icon name="x" :size="16" />
      </button>
    </div>

    <nav class="scroll">
      <template v-if="auth.signedIn">
        <button
          v-for="s in library.playlists"
          :key="s.id"
          class="item"
          :class="{ active: s.id === library.activeId }"
          @click="library.select(s.id)"
        >
          <div class="thumb" :class="s.kind">
            <img v-if="s.thumbnail" :src="s.thumbnail" alt="" loading="lazy" />
            <Icon v-else :name="icon(s)" :size="16" />
          </div>
          <div class="meta">
            <span class="title">{{ s.title }}</span>
            <span class="faint">{{ s.itemCount }} videos</span>
          </div>
        </button>
        <p v-if="!library.playlists.length" class="faint empty">No playlists selected.</p>
        <button class="manage" @click="ui.settingsOpen = true">
          {{ library.playlists.length < library.allPlaylists.length ? `Showing ${library.playlists.length} of ${library.allPlaylists.length} · ` : '' }}Choose playlists…
        </button>
      </template>
      <div v-else class="signin card">
        <Icon name="sparkles" />
        <p>Sign in to load your YouTube playlists and liked videos.</p>
        <button class="btn primary sm" :disabled="!auth.configured" @click="signInAndSync">Sign in with Google</button>
        <p v-if="!auth.configured" class="faint small">Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>.env</code> first.</p>
      </div>

      <div class="side-head sub">
        <span class="label">Imports</span>
        <button class="btn ghost sm icon" title="Import a list" @click="ui.importOpen = true">
          <Icon name="plus" :size="16" />
        </button>
      </div>
      <div v-for="s in library.imports" :key="s.id" class="item-row">
        <button class="item" :class="{ active: s.id === library.activeId }" @click="library.select(s.id)">
          <div class="thumb import"><Icon name="file" :size="16" /></div>
          <div class="meta">
            <span class="title">{{ s.title }}</span>
            <span class="faint">{{ s.itemCount }} videos · local</span>
          </div>
        </button>
        <button class="btn ghost sm icon del" title="Delete import" @click="library.deleteSource(s.id)">
          <Icon name="trash" :size="15" />
        </button>
      </div>
      <button v-if="!library.imports.length" class="import-cta" @click="ui.importOpen = true">
        <Icon name="upload" />
        <span><strong>Import Watch Later</strong><br /><span class="faint">From Google Takeout or pasted links</span></span>
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.side {
  display: flex; flex-direction: column; min-height: 0;
  border-right: 1px solid var(--border); background: rgba(11, 11, 18, .55);
}
@media (max-width: 959px) { .side { background: var(--bg-2); } }
.side-head { display: flex; align-items: center; gap: 4px; padding: 16px 16px 8px; }
.side-head.sub { padding-top: 22px; }
.label { flex: 1; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--text-3); }
.close { display: none; }
@media (max-width: 959px) { .close { display: inline-flex; } }

.scroll { flex: 1; overflow-y: auto; padding: 0 10px 24px; }
.item {
  width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px;
  border: 1px solid transparent; border-radius: 12px; background: none; cursor: pointer; text-align: left;
  transition: background .15s;
}
.item:hover { background: var(--panel); }
.item.active { background: rgba(139, 92, 246, .14); border-color: rgba(139, 92, 246, .35); }
.thumb {
  width: 52px; height: 34px; flex: none; border-radius: 8px; overflow: hidden;
  display: grid; place-items: center; background: var(--panel-2); color: var(--text-2);
}
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb.liked { background: linear-gradient(135deg, rgba(255,61,110,.35), rgba(255,61,110,.1)); color: #ffd1dc; }
.thumb.import { background: linear-gradient(135deg, rgba(34,211,238,.3), rgba(34,211,238,.08)); color: #cffafe; }
.meta { display: flex; flex-direction: column; min-width: 0; }
.title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta .faint { font-size: 12px; }

.item-row { display: flex; align-items: center; }
.item-row .item { flex: 1; min-width: 0; }
.del { opacity: 0; color: var(--text-3); }
.item-row:hover .del, .del:focus-visible { opacity: 1; }
@media (hover: none) { .del { opacity: 1; } }

.signin { margin: 4px 6px; padding: 16px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; color: var(--text-2); }
.signin p { margin: 0; }
.small { font-size: 12px; }
.empty { padding: 0 8px; }
.manage {
  display: block; margin: 4px 8px 0; padding: 4px 0; border: 0; background: none; cursor: pointer;
  font-size: 12px; font-weight: 600; color: var(--text-3);
}
.manage:hover { color: var(--accent-3); }

.import-cta {
  margin: 4px 6px; width: calc(100% - 12px); display: flex; gap: 12px; align-items: center; text-align: left;
  padding: 14px; border-radius: 12px; border: 1px dashed var(--border-strong); background: none; cursor: pointer;
  color: var(--text); transition: border-color .15s, background .15s; font-size: 13px;
}
.import-cta:hover { border-color: var(--accent-3); background: rgba(34, 211, 238, .06); }
</style>
