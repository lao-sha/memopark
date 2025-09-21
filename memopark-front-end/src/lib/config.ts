/**
 * 函数级详细中文注释：前端运行时配置（可替换为 .env 注入）
 * - wsEndpoint：链节点 WebSocket 端点
 * - sponsorApi：平台代付后台的提交地址（POST /forward）
 */
export const AppConfig = {
  wsEndpoint: (import.meta as any)?.env?.VITE_WS || 'ws://127.0.0.1:9944',
  // 函数级详细中文注释：
  // sponsorApi：后端代付接口完整路径；优先使用 VITE_FORWARD_API；
  // backendUrl：后端基础 URL，用于握手/会话等（可选）。
  sponsorApi: (import.meta as any)?.env?.VITE_FORWARD_API || 'http://127.0.0.1:8787/forward',
  backendUrl: (import.meta as any)?.env?.VITE_BACKEND || 'http://127.0.0.1:8787',
}


