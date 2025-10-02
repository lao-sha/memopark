/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_WS: string
  readonly VITE_APP_TITLE: string
  readonly VITE_API_TIMEOUT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

