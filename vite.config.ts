import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/monobank': {
        target: 'https://api.monobank.ua/personal',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/monobank/, ''),
        secure: true,
      },
    },
  },
})
