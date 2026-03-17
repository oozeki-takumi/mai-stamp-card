import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    // Cloudflare Pages は dist フォルダをそのまま公開できる
  },
})
