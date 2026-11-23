<script lang="ts">
import type { Comment } from '../services/youtube'

interface Thread {
  items: Comment[]
  next?: string
  error?: string
}
/** In-memory cache so flipping back to a video doesn't re-spend quota. */
const cache = new Map<string, Thread>()
</script>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { tokenizeComment } from '../lib/commentText'
import { formatCount, formatRelative } from '../lib/format'
import { getCommentThreads, getReplies } from '../services/youtube'
import { useSettings } from '../stores/settings'

const props = defineProps<{ videoId: string; channelId?: string }>()
const emit = defineEmits<{ seek: [seconds: number] }>()

const settings = useSettings()
const thread = ref<Thread | null>(null)
const loading = ref(false)
const expanded = reactive(new Set<string>()) // comment ids with replies shown
const fullText = reactive(new Set<string>()) // comment ids showing full text
const loadingReplies = reactive(new Set<string>())

const key = computed(() => `${props.videoId}:${settings.prefs.commentOrder}`)

async function load(more = false) {
  const k = key.value
  if (!more && cache.has(k)) {
    thread.value = cache.get(k)!
    return
  }
  loading.value = true
  try {
    const page = await getCommentThreads(props.videoId, settings.prefs.commentOrder, more ? thread.value?.next : undefined)
    const prev = more ? cache.get(k)?.items ?? [] : []
    const t: Thread = { items: [...prev, ...page.items], next: page.nextPageToken }
    cache.set(k, t)
    if (k === key.value) thread.value = t
  } catch (e) {
    const t: Thread = { items: [], error: e instanceof Error ? e.message : String(e) }
    if (!more) cache.set(k, t)
    if (k === key.value) thread.value = more ? { ...thread.value!, error: t.error } : t
  } finally {
    loading.value = false
  }
}

watch(key, () => {
  expanded.clear()
  fullText.clear()
  thread.value = null
  void load()
}, { immediate: true })

async function toggleReplies(c: Comment) {
  if (expanded.has(c.id)) return expanded.delete(c.id)
  expanded.add(c.id)
  if (c.replies.length < c.replyCount && !loadingReplies.has(c.id)) {
    loadingReplies.add(c.id)
    try {
      c.replies = await getReplies(c.id)
    } catch {
      /* keep the partial replies we have */
    } finally {
      loadingReplies.delete(c.id)
    }
  }
}

const isLong = (c: Comment) => c.text.length > 320 || c.text.split('\n').length > 6
</script>

<template>
  <div class="comments">
    <div class="bar">
      <div class="seg" role="group" aria-label="Sort comments">
        <button :class="{ on: settings.prefs.commentOrder === 'relevance' }" @click="settings.prefs.commentOrder = 'relevance'">Top</button>
        <button :class="{ on: settings.prefs.commentOrder === 'time' }" @click="settings.prefs.commentOrder = 'time'">Newest</button>
      </div>
    </div>

    <p v-if="thread?.error && !thread.items.length" class="state faint">{{ thread.error }}</p>
    <p v-else-if="thread && !thread.items.length && !loading" class="state faint">No comments yet.</p>

    <ul class="list">
      <li v-for="c in thread?.items ?? []" :key="c.id" class="c">
        <img :src="c.authorAvatar" alt="" class="av" loading="lazy" referrerpolicy="no-referrer" />
        <div class="cb">
          <div class="head">
            <a :href="c.authorUrl" target="_blank" rel="noopener" class="author" :class="{ creator: c.authorChannelId && c.authorChannelId === channelId }">
              {{ c.author }}
            </a>
            <span v-if="c.authorChannelId && c.authorChannelId === channelId" class="badge">Creator</span>
            <span class="faint">{{ formatRelative(c.publishedAt) }}{{ c.edited ? ' (edited)' : '' }}</span>
          </div>

          <p class="text" :class="{ clamp: isLong(c) && !fullText.has(c.id) }">
            <template v-for="(s, i) in tokenizeComment(c.text)" :key="i">
              <button v-if="s.kind === 'time'" class="ts" @click="emit('seek', s.seconds)">{{ s.text }}</button>
              <a v-else-if="s.kind === 'link'" :href="s.href" target="_blank" rel="noopener nofollow">{{ s.text }}</a>
              <template v-else>{{ s.text }}</template>
            </template>
          </p>
          <button v-if="isLong(c)" class="link" @click="fullText.has(c.id) ? fullText.delete(c.id) : fullText.add(c.id)">
            {{ fullText.has(c.id) ? 'Show less' : 'Read more' }}
          </button>

          <div class="meta faint">
            <span v-if="c.likeCount">👍 {{ formatCount(c.likeCount) }}</span>
            <button v-if="c.replyCount" class="link replies" @click="toggleReplies(c)">
              {{ expanded.has(c.id) ? 'Hide' : 'View' }} {{ c.replyCount }} repl{{ c.replyCount === 1 ? 'y' : 'ies' }}
            </button>
          </div>

          <ul v-if="expanded.has(c.id)" class="list replies-list">
            <li v-if="loadingReplies.has(c.id)" class="faint small">Loading replies…</li>
            <li v-for="r in c.replies" :key="r.id" class="c reply">
              <img :src="r.authorAvatar" alt="" class="av sm" loading="lazy" referrerpolicy="no-referrer" />
              <div class="cb">
                <div class="head">
                  <a :href="r.authorUrl" target="_blank" rel="noopener" class="author">{{ r.author }}</a>
                  <span v-if="r.authorChannelId && r.authorChannelId === channelId" class="badge">Creator</span>
                  <span class="faint">{{ formatRelative(r.publishedAt) }}</span>
                </div>
                <p class="text">
                  <template v-for="(s, i) in tokenizeComment(r.text)" :key="i">
                    <button v-if="s.kind === 'time'" class="ts" @click="emit('seek', s.seconds)">{{ s.text }}</button>
                    <a v-else-if="s.kind === 'link'" :href="s.href" target="_blank" rel="noopener nofollow">{{ s.text }}</a>
                    <template v-else>{{ s.text }}</template>
                  </template>
                </p>
                <div v-if="r.likeCount" class="meta faint">👍 {{ formatCount(r.likeCount) }}</div>
              </div>
            </li>
          </ul>
        </div>
      </li>
    </ul>

    <div v-if="loading" class="list">
      <div v-for="n in 3" :key="n" class="c">
        <div class="av skeleton" />
        <div class="cb"><div class="skeleton" style="height: 12px; width: 40%" /><div class="skeleton" style="height: 12px; width: 90%; margin-top: 8px" /></div>
      </div>
    </div>
    <button v-else-if="thread?.next" class="btn sm more" @click="load(true)">Load more comments</button>
    <p v-if="thread?.error && thread.items.length" class="state faint">{{ thread.error }}</p>
  </div>
</template>

<style scoped>
.comments { padding: 4px 16px 16px; }
.bar { display: flex; justify-content: flex-end; margin-bottom: 6px; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; padding: 2px; }
.seg button { height: 26px; padding: 0 12px; border: 0; background: none; border-radius: 99px; cursor: pointer; color: var(--text-3); font-size: 12px; font-weight: 600; }
.seg button.on { background: var(--panel-2); color: var(--text); }

.state { margin: 12px 0; font-size: 13px; }
.small { font-size: 12px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.c { display: flex; gap: 10px; }
.av { width: 32px; height: 32px; border-radius: 50%; flex: none; background: var(--panel-2); object-fit: cover; }
.av.sm { width: 24px; height: 24px; }
.cb { flex: 1; min-width: 0; }
.head { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; font-size: 12px; }
.author { color: var(--text); font-weight: 650; text-decoration: none; }
.author:hover { text-decoration: underline; }
.author.creator { padding: 0 6px; border-radius: 99px; background: rgba(255, 255, 255, .12); }
.badge { font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }

.text { margin: 3px 0 0; font-size: 13px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; color: #dcdce6; }
.text.clamp { display: -webkit-box; -webkit-line-clamp: 6; line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.text a { color: var(--accent-3); }
.ts {
  padding: 0 4px; border: 0; border-radius: 5px; background: rgba(34, 211, 238, .14); color: var(--accent-3);
  font: inherit; font-weight: 600; cursor: pointer;
}
.ts:hover { background: rgba(34, 211, 238, .28); }

.meta { display: flex; gap: 14px; align-items: center; margin-top: 4px; font-size: 12px; }
.link { padding: 0; border: 0; background: none; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--text-2); }
.link:hover { color: var(--text); }
.replies { color: var(--accent-2); }
.replies:hover { color: #b9a2ff; }
.replies-list { margin-top: 12px; gap: 12px; }
.more { width: 100%; margin-top: 16px; }
</style>
