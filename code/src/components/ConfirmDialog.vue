<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useUi } from '../stores/ui'

const ui = useUi()
const okBtn = ref<HTMLButtonElement | null>(null)
onMounted(() => okBtn.value?.focus())
</script>

<template>
  <div v-if="ui.confirmReq" class="overlay" @click.self="ui.answerConfirm(false)" @keydown.esc="ui.answerConfirm(false)">
    <div class="modal" role="alertdialog" aria-modal="true">
      <h2>{{ ui.confirmReq.title }}</h2>
      <p class="muted msg">{{ ui.confirmReq.message }}</p>
      <div class="actions">
        <button class="btn ghost" @click="ui.answerConfirm(false)">Cancel</button>
        <button ref="okBtn" class="btn" :class="ui.confirmReq.danger ? 'danger' : 'primary'" @click="ui.answerConfirm(true)">
          {{ ui.confirmReq.confirmLabel ?? 'OK' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg { white-space: pre-line; margin: 8px 0 0; }
</style>
