import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  // Use repository root .env so the team keeps one shared local file.
  envDir: '../../',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
