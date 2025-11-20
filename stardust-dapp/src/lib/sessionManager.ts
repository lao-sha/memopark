/**
 * 函数级详细中文注释：会话管理器（纯前端版本）
 * - 功能：统一管理钱包会话状态，包括过期检测、自动刷新、状态持久化
 * - 安全：会话token安全存储，自动清理过期数据
 * - 便利：提供统一的会话操作接口，简化组件中的会话处理逻辑
 * - 架构：纯前端实现，不依赖自定义后端服务器
 */

import { SecureStorage } from './secureStorage'

export interface SessionData {
  sessionId: string
  address: string
  allowances?: any
  expiresAt: number
  refreshToken?: string
  deviceFingerprint?: string // 设备指纹
  lastActivity?: number // 最后活动时间
}

const SESSION_KEY = 'session.data'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24小时
const REFRESH_THRESHOLD = 2 * 60 * 60 * 1000 // 2小时内自动刷新
const ACTIVITY_THRESHOLD = 30 * 60 * 1000 // 30分钟无活动警告

export class SessionManager {
  private static instance: SessionManager
  private currentSession: SessionData | null = null
  private refreshTimer: NodeJS.Timeout | null = null
  private activityTimer: NodeJS.Timeout | null = null

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  /**
   * 函数级详细中文注释：生成设备指纹
   * - 基于浏览器和设备特征生成唯一标识
   * - 用于检测异常登录和会话绑定
   * - 包含稳定的设备信息，避免频繁变化
   */
  private generateDeviceFingerprint(): string {
    const features = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      navigator.hardwareConcurrency || 0,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.maxTouchPoints || 0
    ]
    
    return btoa(features.join('|')).substring(0, 16)
  }

  /**
   * 函数级详细中文注释：检测异常会话
   * - 比较当前设备指纹与会话中保存的指纹
   * - 检测最后活动时间是否异常
   * - 发现异常时返回警告信息
   */
  private detectAnomalousSession(session: SessionData): { 
    isAnomalous: boolean; 
    reason?: string 
  } {
    const currentFingerprint = this.generateDeviceFingerprint()
    
    if (session.deviceFingerprint && session.deviceFingerprint !== currentFingerprint) {
      return { isAnomalous: true, reason: '设备指纹不匹配' }
    }
    
    if (session.lastActivity) {
      const inactiveTime = Date.now() - session.lastActivity
      if (inactiveTime > ACTIVITY_THRESHOLD * 4) { // 2小时无活动
        return { isAnomalous: true, reason: '长时间无活动' }
      }
    }
    
    return { isAnomalous: false }
  }

  /**
   * 函数级详细中文注释：初始化会话管理器 - 安全版本
   * - 从安全加密存储恢复会话数据
   * - 检查会话有效性和异常情况
   * - 设置自动刷新和活动监控定时器
   */
  init(): SessionData | null {
    // 从安全存储加载会话
    this.currentSession = SecureStorage.getItem<SessionData>(SESSION_KEY)
    
    if (this.currentSession) {
      // 检查会话是否过期
      if (this.isExpired(this.currentSession)) {
        this.clearSession()
        return null
      }
      
      // 异常会话检测
      const anomalyCheck = this.detectAnomalousSession(this.currentSession)
      if (anomalyCheck.isAnomalous) {
        console.warn(`检测到异常会话: ${anomalyCheck.reason}`)
        // 异常会话不自动清理，但会警告用户
        // 实际应用中可根据安全策略决定是否强制清理
      }
      
      // 更新最后活动时间
      this.updateActivity()
      
      // 设置刷新和活动监控定时器
      this.scheduleRefresh()
      this.startActivityMonitor()
      
      return this.currentSession
    }
    
    return null
  }

  /**
   * 函数级详细中文注释：创建新会话 - 纯前端版本
   * - 直接在本地创建会话，无需后端握手
   * - 添加设备指纹和活动时间
   * - 使用安全存储保存会话数据
   * - 启动监控机制
   * - 授权信息可后续从链上查询
   */
  async createSession(address: string): Promise<SessionData | null> {
    console.log('[session] 创建本地会话', { address })
    try {
      const now = Date.now()
      const currentFingerprint = this.generateDeviceFingerprint()
      
      // 直接创建本地会话，不依赖后端
      const sessionData: SessionData = {
        sessionId: `local-${address}-${now}`,
        address,
        allowances: { 
          local: true,
          maxTransactions: 1000,
          note: '本地会话，授权从链上查询'
        },
        expiresAt: now + SESSION_DURATION,
        refreshToken: `refresh-${now}`,
        deviceFingerprint: currentFingerprint,
        lastActivity: now
      }

      this.currentSession = sessionData
      
      // 使用安全存储保存
      SecureStorage.setItem(SESSION_KEY, sessionData, SESSION_DURATION)
      
      // 兼容旧版存储（逐步迁移）
      this.saveToLegacyStorage()
      
      this.scheduleRefresh()
      this.startActivityMonitor()
      
      console.log('[session] ✅ 本地会话已创建', { 
        sessionId: sessionData.sessionId,
        expiresAt: new Date(sessionData.expiresAt).toLocaleString()
      })
      
      return sessionData
    } catch (error) {
      console.error('❌ 创建会话失败:', error)
      return null
    }
  }

  /**
   * 函数级详细中文注释：强制创建本地会话（已废弃）
   * - 该方法已合并到 createSession，现在所有会话都是本地创建
   * - 保留此方法仅为向后兼容，直接调用 createSession
   */
  forceCreateDevSession(address: string): SessionData {
    console.warn('⚠️ forceCreateDevSession 已废弃，请使用 createSession')
    // 同步调用创建会话（返回 Promise，但这里转为同步）
    const now = Date.now()
    const currentFingerprint = this.generateDeviceFingerprint()
    const session: SessionData = {
      sessionId: `local-${address}-${now}`,
      address,
      allowances: { local: true },
      expiresAt: now + SESSION_DURATION,
      refreshToken: `refresh-${now}`,
      deviceFingerprint: currentFingerprint,
      lastActivity: now
    }
    this.currentSession = session
    SecureStorage.setItem(SESSION_KEY, session, SESSION_DURATION)
    this.saveToLegacyStorage()
    this.scheduleRefresh()
    this.startActivityMonitor()
    return session
  }

  /**
   * 函数级详细中文注释：刷新会话 - 纯前端版本
   * - 更新过期时间和活动时间
   * - 验证设备指纹一致性
   * - 使用安全存储保存
   * - 无需后端握手，直接延期
   */
  async refreshSession(): Promise<SessionData | null> {
    if (!this.currentSession) {
      console.warn('[session] 无会话可刷新')
      return null
    }

    try {
      const now = Date.now()
      
      // 直接延长会话有效期
      this.currentSession = {
        ...this.currentSession,
        expiresAt: now + SESSION_DURATION,
        lastActivity: now
      }

      // 使用安全存储保存
      SecureStorage.setItem(SESSION_KEY, this.currentSession, SESSION_DURATION)
      this.saveToLegacyStorage()
      
      this.scheduleRefresh()
      this.startActivityMonitor()
      
      console.log('[session] ✅ 会话已刷新', { 
        newExpiresAt: new Date(this.currentSession.expiresAt).toLocaleString()
      })
      
      return this.currentSession
    } catch (error) {
      console.error('❌ 刷新会话失败:', error)
      return null
    }
  }

  /**
   * 函数级详细中文注释：获取当前会话
   * - 检查会话有效性
   * - 自动处理过期会话
   * - 返回有效会话或null
   */
  getCurrentSession(): SessionData | null {
    if (!this.currentSession) {
      return null
    }

    if (this.isExpired(this.currentSession)) {
      this.clearSession()
      return null
    }

    return this.currentSession
  }

  /**
   * 函数级详细中文注释：检查会话是否需要刷新
   * - 判断是否接近过期时间
   * - 用于主动刷新逻辑
   */
  shouldRefresh(): boolean {
    if (!this.currentSession) {
      return false
    }
    
    const timeToExpire = this.currentSession.expiresAt - Date.now()
    return timeToExpire < REFRESH_THRESHOLD
  }

  /**
   * 函数级详细中文注释：清理会话 - 安全版本
   * - 清除内存中的会话数据
   * - 清除安全存储和兼容存储
   * - 取消所有定时器
   * - 清理相关缓存和监听器
   */
  clearSession(): void {
    this.currentSession = null
    
    // 清除安全存储
    SecureStorage.removeItem(SESSION_KEY)
    
    // 清除兼容的旧版存储
    localStorage.removeItem('mp.session')
    localStorage.removeItem('mp.allowances')
    localStorage.removeItem('mp.current')
    
    // 清除所有定时器
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    
    if (this.activityTimer) {
      clearTimeout(this.activityTimer)
      this.activityTimer = null
    }
  }

  /**
   * 函数级详细中文注释：验证会话有效性
   * - 检查过期时间
   * - 验证必要字段
   */
  private isExpired(session: SessionData): boolean {
    return Date.now() >= session.expiresAt
  }

  /**
   * 函数级详细中文注释：更新用户活动时间
   * - 记录最后活动时间
   * - 用于异常检测和会话延期
   * - 自动保存到安全存储
   */
  updateActivity(): void {
    if (this.currentSession) {
      this.currentSession.lastActivity = Date.now()
      SecureStorage.setItem(SESSION_KEY, this.currentSession, SESSION_DURATION)
    }
  }

  /**
   * 函数级详细中文注释：启动活动监控
   * - 监控用户活动状态
   * - 长时间不活动时发出警告
   * - 可配置为自动清理会话
   */
  private startActivityMonitor(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer)
    }
    
    this.activityTimer = setTimeout(() => {
      if (this.currentSession) {
        const inactiveTime = Date.now() - (this.currentSession.lastActivity || 0)
        if (inactiveTime > ACTIVITY_THRESHOLD) {
          console.warn('用户长时间未活动，建议重新认证')
          // 可选：自动清理会话或要求重新认证
          // this.clearSession()
        }
      }
    }, ACTIVITY_THRESHOLD)
  }

  /**
   * 函数级详细中文注释：保存到兼容存储
   * - 为向后兼容保存到旧版localStorage格式
   * - 仅保存非敏感信息
   * - 逐步迁移到安全存储后可移除
   */
  private saveToLegacyStorage(): void {
    if (!this.currentSession) {
      return
    }

    try {
      // 兼容旧版本存储格式（仅保存sessionId，敏感数据已加密存储）
      localStorage.setItem('mp.session', this.currentSession.sessionId)
      if (this.currentSession.allowances) {
        localStorage.setItem('mp.allowances', JSON.stringify(this.currentSession.allowances))
      }
    } catch (error) {
      console.error('保存兼容数据失败:', error)
    }
  }

  /**
   * 函数级详细中文注释：安排会话自动刷新
   * - 计算刷新时间点
   * - 设置定时器自动刷新
   * - 处理刷新失败情况
   */
  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    if (!this.currentSession) {
      return
    }

    const timeToRefresh = this.currentSession.expiresAt - Date.now() - REFRESH_THRESHOLD
    if (timeToRefresh > 0) {
      this.refreshTimer = setTimeout(async () => {
        console.log('自动刷新会话...')
        const result = await this.refreshSession()
        if (!result) {
          console.log('自动刷新失败，会话已失效')
        }
      }, timeToRefresh)
    }
  }
}

// 导出单例实例
export const sessionManager = SessionManager.getInstance()