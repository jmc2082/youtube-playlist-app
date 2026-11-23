<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { useLibrary } from '../stores/library'
import { useUi } from '../stores/ui'

const library = useLibrary()
const ui = useUi()
const filter = ref('')
const newName = ref('')
const creating = ref(false)

const options = computed(() =>
  library.writablePlaylists.filter(
    (p) => p.playlistId !== ui.pickReq?.excludeId && p.title.toLowerCase().includes(filter.value.toLowerCase()),
  ),
)

async function create() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  try {
    ui.answerPick(await library.createPlaylist(name))
  } catch (e) {
    ui.error(e)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div v-if="ui.pickReq" class="overlay" @click.self="ui.answerPick(null)" @keydown.esc="ui.answerPick(null)">
    <div class="modal">
      <h2>{{ ui.pickReq.title }}</h2>
      <input v-model="filter" class="input search" placeholder="Filter playlists" />
      <div class="list">
        <button v-for="p in options" :key="p.id" class="pl" @click="ui.answerPick(p.playlistId!)">
          <img v-if="p.thumbnail" :src="p.thumbnail" alt="" />
          <div v-else class="ph"><Icon name="playlist" :size="16" /></div>
          <span class="name">{{ p.title }}</span>
          <span class="faint">{{ p.itemCount }}</span>
        </button>
        <p v-if="!options.length" class="faint">No matching playlists.</p>
      </div>
      <form class="new" @submit.prevent="create">
        <input v-model="newName" class="input" placeholder="New private playlist name" />
        <button class="btn" :disabled="!newName.trim() || creating"><Icon name="plus" :size="16" />Create</button>
      </form>
      <div class="actions"><button class="btn ghost" @click="ui.answerPick(null)">Cancel</button></div>
    </div>
  </div>
</template>

<style scoped>
.search { width: 100%; margin: 10px 0; }
.list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; margin: 0 -6px; }
.pl { display: flex; align-items: center; gap: 12px; padding: 8px; border: 0; background: none; border-radius: 10px; cursor: pointer; text-align: left; }
.pl:hover { background: var(--panel-2); }
.pl img, .ph { width: 56px; aspect-ratio: 16/9; border-radius: 6px; object-fit: cover; flex: none; display: grid; place-items: center; background: var(--panel-2); }
.name { flex: 1; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.new { display: flex; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.new .input { flex: 1; }
</style>
