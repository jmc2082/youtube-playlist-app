<script setup lang="ts">
import Icon from './Icon.vue'
import { useUi } from '../stores/ui'
const ui = useUi()
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="t">
      <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.kind" @click="ui.dismiss(t.id)">
        <Icon :name="t.kind === 'error' ? 'x' : t.kind === 'success' ? 'check' : 'sparkles'" :size="16" />
        <span>{{ t.text }}</span>
      </div>
    </TransitionGroup>
    <div v-if="ui.busy" class="toast busy">
      <span class="spin" />
      <span>{{ ui.busy.label }}<template v-if="ui.busy.total > 1"> · {{ ui.busy.done }}/{{ ui.busy.total }}</template></span>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed; z-index: 150; right: 16px; bottom: 16px; left: auto;
  display: flex; flex-direction: column; gap: 8px; align-items: flex-end; pointer-events: none;
}
.toast {
  pointer-events: auto; display: flex; align-items: center; gap: 10px; max-width: 380px;
  padding: 11px 14px; border-radius: 12px; font-size: 13px; font-weight: 500; cursor: pointer;
  background: var(--panel-solid); border: 1px solid var(--border-strong); box-shadow: var(--shadow);
}
.toast.success :deep(svg) { color: var(--ok); }
.toast.error { border-color: rgba(248, 113, 113, .5); }
.toast.error :deep(svg) { color: var(--danger); }
.toast.info :deep(svg) { color: var(--accent-2); }
.spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.2); border-top-color: var(--accent); animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.t-enter-active, .t-leave-active { transition: all .2s ease; }
.t-enter-from, .t-leave-to { opacity: 0; transform: translateY(10px); }
@media (max-width: 600px) {
  .toasts { left: 12px; right: 12px; bottom: 12px; align-items: stretch; }
  .toast { max-width: none; }
}
</style>
