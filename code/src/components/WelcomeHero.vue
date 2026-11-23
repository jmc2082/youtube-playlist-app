<script setup lang="ts">
import Icon from './Icon.vue'
import { useAuth } from '../stores/auth'
import { useLibrary } from '../stores/library'
import { useUi } from '../stores/ui'
import { signInAndSync } from '../composables/session'

const auth = useAuth()
const library = useLibrary()
const ui = useUi()
</script>

<template>
  <div class="welcome">
    <div class="glow" />
    <span class="eyebrow">Your YouTube queue, finally in order</span>
    <h1>Watch the <span class="grad-text">short ones first.</span></h1>
    <p class="lead muted">
      Pull in your playlists, sort by length or upload date, and play through them in one tidy queue.
    </p>

    <div class="cta">
      <button v-if="!auth.signedIn" class="btn primary lg" :disabled="!auth.configured" @click="signInAndSync">
        Sign in with Google
      </button>
      <button class="btn lg" @click="ui.importOpen = true"><Icon name="upload" />Import Watch Later</button>
    </div>

    <p v-if="auth.signedIn && library.sources.length" class="muted">Pick a playlist from your library to get started.</p>

    <div v-if="!auth.configured" class="setup card">
      <h3><Icon name="settings" /> One-time setup</h3>
      <ol>
        <li>Create a project in <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a> and enable <strong>YouTube Data API v3</strong>.</li>
        <li>Configure the OAuth consent screen (External, Testing) and add yourself as a test user.</li>
        <li>Create an <strong>OAuth client ID</strong> (Web application) with origin <code>http://localhost:5173</code>.</li>
        <li>Copy <code>.env.example</code> to <code>.env</code>, paste the client ID, and restart <code>npm run dev</code>.</li>
      </ol>
    </div>

    <div class="features">
      <div class="f card"><Icon name="clock" /><strong>Sort by length</strong><span class="muted">30-second clips first, 2-hour deep dives last — or flip it.</span></div>
      <div class="f card"><Icon name="sort" /><strong>Sort by date</strong><span class="muted">Newest uploads, oldest, or when you saved them.</span></div>
      <div class="f card"><Icon name="play" /><strong>Queue & play</strong><span class="muted">Auto-advances and keeps track of what you’ve watched.</span></div>
      <div class="f card"><Icon name="save" /><strong>Save to YouTube</strong><span class="muted">Write a sorted order back to your real playlist.</span></div>
    </div>
  </div>
</template>

<style scoped>
.welcome { position: relative; max-width: 880px; margin: 0 auto; padding: clamp(24px, 6vh, 72px) 0 24px; text-align: center; }
.glow {
  position: absolute; inset: -40px 10% auto; height: 260px; z-index: -1; filter: blur(60px); opacity: .5;
  background: radial-gradient(closest-side, rgba(255, 61, 110, .55), transparent), radial-gradient(closest-side at 70% 50%, rgba(139, 92, 246, .6), transparent);
}
.eyebrow { display: inline-block; padding: 6px 12px; border-radius: 99px; border: 1px solid var(--border-strong); font-size: 12px; font-weight: 600; color: var(--text-2); }
h1 { font-size: clamp(34px, 6vw, 60px); line-height: 1.04; letter-spacing: -.035em; margin: 18px 0 14px; font-weight: 800; }
.lead { font-size: clamp(15px, 2vw, 18px); max-width: 560px; margin: 0 auto; }
.cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin: 28px 0 14px; }
.btn.lg { height: 46px; padding: 0 22px; font-size: 14.5px; }

.setup { text-align: left; padding: 18px 20px; margin: 28px auto 0; max-width: 620px; border-color: rgba(255, 61, 110, .35); }
.setup h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 15px; }
.setup ol { margin: 0; padding-left: 20px; color: var(--text-2); display: grid; gap: 6px; }
code { background: rgba(255, 255, 255, .08); padding: 1px 6px; border-radius: 5px; font-size: 12.5px; }

.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-top: 40px; text-align: left; }
.f { padding: 16px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.f :deep(svg) { color: var(--accent); margin-bottom: 4px; }
.f strong { font-size: 14px; }

@media (max-width: 600px) { .cta .btn { flex: 1 1 100%; } }
</style>
