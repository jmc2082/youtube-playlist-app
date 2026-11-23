<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'
import { useAuth } from '../stores/auth'
import { useLibrary } from '../stores/library'
import { DAILY_QUOTA, useQuota } from '../stores/quota'
import { useUi } from '../stores/ui'
import { signInAndSync } from '../composables/session'

const auth = useAuth()
const quota = useQuota()
const library = useLibrary()
const ui = useUi()
const menuOpen = ref(false)

function signOut() {
  menuOpen.value = false
  auth.signOut()
  library.forgetAccount()
  ui.toast('Signed out')
}
</script>

<template>
  <header class="header">
    <button class="btn ghost icon burger" aria-label="Open library" @click="ui.sidebarOpen = true">
      <Icon name="menu" />
    </button>

    <div class="brand">
      <img src="/favicon.svg" alt="" width="30" height="30" />
      <span class="name">Tube<span class="grad-text">Sort</span></span>
    </div>

    <div class="spacer" />

    <div
      v-if="auth.signedIn"
      class="quota"
      :title="`~${quota.used.toLocaleString()} of ${DAILY_QUOTA.toLocaleString()} daily API units used (local estimate). Resets midnight Pacific.`"
    >
      <span class="faint">API</span>
      <div class="meter"><div :style="{ width: `${quota.pct}%` }" :class="{ hot: quota.pct > 80 }" /></div>
    </div>

    <button class="btn hide-sm" @click="ui.importOpen = true"><Icon name="upload" />Import</button>
    <button class="btn ghost icon" aria-label="Settings" @click="ui.settingsOpen = true"><Icon name="settings" /></button>

    <button v-if="!auth.signedIn" class="btn primary signin" :disabled="!auth.configured" @click="signInAndSync">
      Sign in<span class="hide-sm">with Google</span>
    </button>
    <div v-else class="account">
      <button class="avatar-btn" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
        <img v-if="auth.channel?.thumbnail" :src="auth.channel.thumbnail" alt="" referrerpolicy="no-referrer" />
        <span v-else>{{ auth.channel?.title?.[0] ?? '?' }}</span>
      </button>
      <div v-if="menuOpen" class="click-away" @click="menuOpen = false" />
      <div v-if="menuOpen" class="menu card">
        <div class="who">
          <strong>{{ auth.channel?.title ?? 'Signed in' }}</strong>
          <span class="faint">YouTube account</span>
        </div>
        <button class="btn ghost" @click="signOut"><Icon name="logout" />Sign out</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  height: var(--header-h); flex: none;
  display: flex; align-items: center; gap: 10px; padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(11, 11, 18, .7); backdrop-filter: blur(16px);
  position: relative; z-index: 40;
}
.brand { display: flex; align-items: center; gap: 10px; }
.name { font-weight: 800; font-size: 19px; letter-spacing: -.02em; }
.spacer { flex: 1; }
.signin { gap: .3em; }
.burger { display: none; }

.quota { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: .06em; margin-right: 4px; }
.meter { width: 72px; height: 6px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; }
.meter > div { height: 100%; background: var(--ok); border-radius: 99px; transition: width .3s; }
.meter > div.hot { background: var(--accent); }

.account { position: relative; }
.avatar-btn {
  width: 38px; height: 38px; border-radius: 50%; border: 2px solid transparent;
  background: var(--grad) border-box; padding: 0; cursor: pointer; overflow: hidden;
  display: grid; place-items: center; font-weight: 800;
}
.avatar-btn img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.click-away { position: fixed; inset: 0; }
.menu {
  position: absolute; right: 0; top: 48px; min-width: 220px; padding: 8px;
  background: var(--panel-solid); box-shadow: var(--shadow);
}
.menu .who { display: flex; flex-direction: column; padding: 8px 10px 10px; border-bottom: 1px solid var(--border); margin-bottom: 6px; }
.menu .btn { width: 100%; justify-content: flex-start; border-radius: 8px; }

@media (max-width: 959px) { .burger { display: inline-flex; } }
@media (max-width: 600px) {
  .header { padding: 0 10px; gap: 6px; }
  .hide-sm { display: none; }
  .quota { display: none; }
}
</style>
