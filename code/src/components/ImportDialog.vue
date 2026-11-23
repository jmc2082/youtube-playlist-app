<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { parseImport } from '../lib/takeout'
import { useLibrary } from '../stores/library'
import { useUi } from '../stores/ui'

const library = useLibrary()
const ui = useUi()

const title = ref('Watch Later')
const text = ref('')
const fileName = ref('')
const dragging = ref(false)
const entries = computed(() => parseImport(text.value))

async function readFile(f: File | undefined) {
  if (!f) return
  fileName.value = f.name
  text.value = await f.text()
  const base = f.name.replace(/\.csv$/i, '').replace(/-videos$/i, '').trim()
  if (base) title.value = base
}
function onDrop(e: DragEvent) {
  dragging.value = false
  void readFile(e.dataTransfer?.files[0])
}
async function submit() {
  if (!entries.value.length) return
  ui.importOpen = false
  await library.importList(title.value.trim() || 'Imported list', entries.value).catch(ui.error)
}
</script>

<template>
  <div class="overlay" @click.self="ui.importOpen = false" @keydown.esc="ui.importOpen = false">
    <form class="modal" @submit.prevent="submit">
      <h2>Import a list</h2>
      <p class="muted intro">
        YouTube’s API can’t read <strong>Watch Later</strong>, so bring it in from
        <a href="https://takeout.google.com/" target="_blank" rel="noopener">Google Takeout</a>
        → YouTube → playlists → <code>Watch later-videos.csv</code>. Or paste any YouTube links.
      </p>

      <label
        class="drop"
        :class="{ dragging, has: fileName }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <input type="file" accept=".csv,.txt,text/csv,text/plain" class="sr-only" @change="readFile(($event.target as HTMLInputElement).files?.[0])" />
        <Icon :name="fileName ? 'file' : 'upload'" :size="22" />
        <span v-if="fileName"><strong>{{ fileName }}</strong></span>
        <span v-else><strong>Drop a CSV here</strong> or click to choose</span>
      </label>

      <div class="or faint"><span>or paste links</span></div>
      <textarea v-model="text" class="input" rows="5" placeholder="https://www.youtube.com/watch?v=…&#10;https://youtu.be/…" @input="fileName = ''" />

      <label class="field">
        <span class="faint">List name</span>
        <input v-model="title" class="input" required />
      </label>

      <div class="actions">
        <span class="found" :class="{ ok: entries.length }">{{ entries.length }} video{{ entries.length === 1 ? '' : 's' }} found</span>
        <button type="button" class="btn ghost" @click="ui.importOpen = false">Cancel</button>
        <button type="submit" class="btn primary" :disabled="!entries.length">Import</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.intro { margin: 0 0 16px; }
code { background: rgba(255, 255, 255, .08); padding: 1px 6px; border-radius: 5px; font-size: 12px; }
.drop {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 26px 16px;
  border: 1.5px dashed var(--border-strong); border-radius: 14px; cursor: pointer; text-align: center; color: var(--text-2);
  transition: border-color .15s, background .15s;
}
.drop:hover, .drop.dragging { border-color: var(--accent-2); background: rgba(139, 92, 246, .08); }
.drop.has { border-style: solid; border-color: rgba(52, 211, 153, .5); color: var(--text); }
.drop:focus-within { outline: 2px solid var(--accent-2); outline-offset: 2px; }
.or { display: flex; align-items: center; gap: 10px; margin: 14px 0 10px; font-size: 12px; }
.or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.field { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; font-size: 12px; }
.actions { align-items: center; }
.found { margin-right: auto; font-size: 12.5px; color: var(--text-3); font-weight: 600; }
.found.ok { color: var(--ok); }
</style>
