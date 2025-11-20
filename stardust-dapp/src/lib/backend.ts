/**
 * ⚠️ 废弃文件通知 ⚠️
 * 
 * 本文件已废弃，不再使用自定义后端服务器（8787端口）
 * 
 * 架构变更说明：
 * - 旧架构：前端 → 自定义后端 (8787) → 区块链节点 (9944)
 * - 新架构：前端 → 区块链节点 (9944) ✅
 * 
 * 变更原因：
 * 1. 更符合 Web3 去中心化理念
 * 2. 降低部署和维护复杂度
 * 3. 提高系统可靠性和安全性
 * 4. 会话管理改为纯前端实现
 * 
 * 如需恢复后端功能，请参考以下设计：
 * - 用途：监控、审计、速率限制（非核心认证）
 * - 技术栈：Node.js/Python/Rust + REST API
 * - 端点：GET /challenge, POST /verify
 * 
 * 变更日期：2025-11-08
 * 相关文件：
 * - src/lib/sessionManager.ts (已更新为纯前端实现)
 * - src/lib/config.ts (已移除后端配置)
 */

// 为向后兼容保留接口定义
export interface HandshakeResult {
  sessionId?: string
  allowances?: any
  error?: string
  detail?: any
}

// 废弃函数 - 仅保留以避免编译错误
export async function handshakeWithBackend(address: string): Promise<HandshakeResult | null> {
  console.warn('⚠️ handshakeWithBackend 已废弃，不再使用后端握手')
  console.warn('📌 会话现在由前端直接创建，请使用 sessionManager.createSession()')
  
  return {
    error: 'DEPRECATED',
    detail: '此函数已废弃，请使用 sessionManager.createSession() 创建本地会话'
  }
}
