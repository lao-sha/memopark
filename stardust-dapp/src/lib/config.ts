/**
 * 函数级详细中文注释：前端运行时配置（纯链上架构）
 * 
 * 配置说明：
 * - wsEndpoint：Substrate 区块链节点 WebSocket 端点
 * - sponsorApi：交易代付接口（可选，用于无Gas交易）
 * 
 * 架构变更（2025-11-08）：
 * ❌ 已移除：backendUrl（自定义后端服务器，8787端口）
 * ✅ 新架构：前端直连区块链节点，无需中间层后端
 * 
 * 如需恢复后端功能：
 * - 用途应限于：监控、审计、速率限制（非核心认证）
 * - 不应参与：会话管理、用户认证、授权验证
 */
export const AppConfig = {
  // Substrate 区块链节点 WebSocket 端点
  wsEndpoint: (import.meta as any)?.env?.VITE_WS || 'ws://127.0.0.1:9944',
  
  // 交易代付接口（可选）
  // 注意：代付功能也可以改为链上实现（使用 Proxy 或 Multisig）
  sponsorApi: (import.meta as any)?.env?.VITE_FORWARD_API || 'http://127.0.0.1:8787/forward',
  
  // ⚠️ 已废弃：backendUrl（保留注释供参考）
  // backendUrl: 'http://127.0.0.1:8787' // 不再使用
}
