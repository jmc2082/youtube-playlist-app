import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // Must match an "Authorized JavaScript origin" on your OAuth client.
    port: 5173,
    strictPort: true,
  },
})
