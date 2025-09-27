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
  // 函数级详细中文注释：开发服务代理配置
  // - 目标：在本地开发环境通过 Vite 代理转发 /api/** 请求到远端 111.170.145.41，规避浏览器同源策略的 CORS 限制
  // - 使用：前端代码改为请求相对路径 /api/...，Vite dev server 将在开发时转发；生产部署请在网关或后端配置反向代理
  server: {
    host: '127.0.0.1',
    proxy: {
      // 本地后端签名代理（默认 8888）
      '/proxy': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
        secure: false,
        rewrite: (p: string) => p,
      },
      '/api': {
        target: 'http://111.170.145.41',
        changeOrigin: true,
        secure: false,
        // 此处保持路径不改写：/api/pay/create -> http://111.170.145.41/api/pay/create
        rewrite: (path: string) => path,
      },
      // 新增：直连 mapi.php 的代理，避免跨域预检拦截
      '/mapi.php': {
        target: 'http://111.170.145.41',
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => path,
      },
    },
  },
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
