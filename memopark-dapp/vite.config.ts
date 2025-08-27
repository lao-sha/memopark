import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 兼容浏览器环境的 Node 内置模块/全局变量（process、Buffer、crypto 等）
    nodePolyfills({
      protocolImports: true,
    }),
  ],
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { global: 'globalThis' },
    },
  },
  build: { target: 'es2020' },
})
