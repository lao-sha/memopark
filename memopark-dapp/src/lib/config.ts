/**
 * 函数级详细中文注释：前端运行时配置（可替换为 .env 注入）
 * - wsEndpoint：链节点 WebSocket 端点
 * - sponsorApi：平台代付后台的提交地址（POST /forward）
 */
export const AppConfig = {
  wsEndpoint: (import.meta as any)?.env?.VITE_WS || 'wss://localhost:9944',
  sponsorApi: (import.meta as any)?.env?.VITE_FORWARD_API || 'https://platform.example.com/forward',
}


