import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // Ensure assets are loaded with relative paths in Electron
  plugins: [react(), tailwindcss()],
})
