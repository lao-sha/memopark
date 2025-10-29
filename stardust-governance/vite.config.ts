import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        modifyVars: {
          '@primary-color': '#1890ff',
          '@border-radius-base': '4px',
          '@layout-header-height': '64px',
          '@layout-sider-width': '256px'
        }
      }
    }
  },
  
  server: {
    port: 3000,
    open: true,
    host: '0.0.0.0'
  },
  
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons', '@ant-design/pro-components'],
          'polkadot-vendor': ['@polkadot/api', '@polkadot/extension-dapp', '@polkadot/util']
        }
      }
    }
  },
  
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'antd',
      '@polkadot/api',
      '@polkadot/extension-dapp'
    ]
  }
})

