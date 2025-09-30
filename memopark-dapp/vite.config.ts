import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import fs from 'fs'
import path from 'path'

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
      // 函数级详细中文注释：为被代理的后端请求自动注入鉴权与防重放头部
      // - 设计：优先读取 VITE_EPAY_API_TOKEN；若未设置则尝试读取 ../epay/.api_token 文件；
      // - 动态为每个请求设置 X-Timestamp 与 X-Nonce，避免固定值导致的过期或复用
      // - 注意：仅在开发代理层生效，不影响生产环境
      '/mapi.php': (() => {
        const token = process.env.VITE_EPAY_API_TOKEN || (() => {
          try {
            const p = path.resolve(process.cwd(), '../epay/.api_token')
            if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
          } catch {}
          return ''
        })()
        return {
          target: 'http://111.170.145.41',
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path,
          configure: (proxy: any) => {
            proxy.on('proxyReq', (proxyReq: any) => {
              if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`)
              proxyReq.setHeader('X-Timestamp', String(Math.floor(Date.now() / 1000)))
              proxyReq.setHeader('X-Nonce', `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`)
            })
          },
        }
      })(),
      // 直接转发到 epay 服务器
      '/epay': {
        target: 'http://111.170.145.41',
        changeOrigin: true,
        secure: false,
        rewrite: (p: string) => p,
        configure: (proxy: any) => {
          const token = process.env.VITE_EPAY_API_TOKEN || (() => {
            try {
              const p = path.resolve(process.cwd(), '../epay/.api_token')
              if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
            } catch {}
            return ''
          })()
          proxy.on('proxyReq', (proxyReq: any, req: any) => {
            // 仅对需要鉴权的简化查询接口注入（act=order_simple）
            if (req?.url && req.url.includes('act=order_simple')) {
              if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`)
              proxyReq.setHeader('X-Timestamp', String(Math.floor(Date.now() / 1000)))
              proxyReq.setHeader('X-Nonce', `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`)
            }
          })
        },
      },
      '/api': {
        target: 'http://111.170.145.41',
        changeOrigin: true,
        secure: false,
        // 此处保持路径不改写：/api/pay/create -> http://111.170.145.41/api/pay/create
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
