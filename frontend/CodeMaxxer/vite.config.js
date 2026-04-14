import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@home': path.resolve(__dirname, './src/pages/Home'),
      '@login': path.resolve(__dirname, './src/pages/Login'),
      '@dashboard': path.resolve(__dirname, './src/pages/Dashboard'),
      '@d_general': path.resolve(__dirname, './src/pages/Dashboard/components/general'),
      '@d_study': path.resolve(__dirname, './src/pages/Dashboard/components/study'),
      '@d_support': path.resolve(__dirname, './src/pages/Dashboard/components/support'),
      '@dashboardStyles': path.resolve(__dirname, './src/styles/dashboard'),
      '@callback': path.resolve(__dirname, './src/pages/LoginCallback'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
})
