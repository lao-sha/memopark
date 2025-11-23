/// Stardust智能群聊 - 乐观UI更新管理器
///
/// 实现50ms瞬时响应的核心前端架构

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import smartChatService from '../services/smartChatService';

// ========== 类型定义 ==========

/// 消息状态类型
export type MessageStatus =
  | 'composing'    // 编辑中
  | 'pending'      // 待确认（灰色）
  | 'encrypting'   // 加密中（进度条）
  | 'uploading'    // 上传中（进度条）
  | 'submitting'   // 上链中（转圈）
  | 'confirmed'    // 已确认（绿色）
  | 'failed'       // 失败（红色）
  | 'retrying';    // 重试中（黄色）

/// 处理阶段枚举
export enum ProcessingStage {
  STARTING = 'starting',
  ENCRYPTING = 'encrypting',
  UPLOADING_IPFS = 'uploading_ipfs',
  SUBMITTING_TRANSACTION = 'submitting_transaction',
  WAITING_CONFIRMATION = 'waiting_confirmation',
  FINALIZING = 'finalizing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/// 乐观消息完整数据结构
export interface OptimisticMessage {
  // 标识信息
  tempId: string;              // 前端临时ID
  realId?: string;             // 链上真实ID（确认后）

  // 消息内容
  sender: string;
  receiver?: string;           // 私聊接收者
  groupId?: string;           // 群组ID
  content: string;
  timestamp: number;

  // 状态管理
  status: MessageStatus;
  progress: number;            // 0-100 进度百分比
  stage: ProcessingStage;      // 当前处理阶段

  // 错误处理
  retryCount: number;
  maxRetries: number;
  errorInfo?: string;

  // 时间预测
  estimatedConfirmTime: number;
  actualConfirmTime?: number;

  // 用户交互
  canCancel: boolean;
  canRetry: boolean;

  // 可视化
  animationState: 'enter' | 'normal' | 'updating' | 'confirmed' | 'error';
}

/// 乐观操作选项
export interface OptimisticOptions {
  priority?: 'low' | 'normal' | 'high' | 'emergency';
  encryptionMode?: 'military' | 'business' | 'selective' | 'transparent';
  enableRetry?: boolean;
  maxRetries?: number;
  customEstimatedTime?: number;
}

/// 乐观操作结果
export interface OptimisticResult {
  tempId: string;
  promise: Promise<string>; // 返回真实ID
  estimatedTime: number;
}

/// 时间预测结果
export interface TimingPrediction {
  totalTime: number;
  stages: {
    [K in ProcessingStage]?: number;
  };
  confidence: number;
}

/// 冲突解决策略
export enum ConflictResolutionStrategy {
  USE_CHAIN_MESSAGE = 'USE_CHAIN_MESSAGE',
  MERGE_MESSAGES = 'MERGE_MESSAGES',
  KEEP_OPTIMISTIC = 'KEEP_OPTIMISTIC',
  USER_DECISION = 'USER_DECISION',
}

/// 冲突解决结果
export interface ConflictResolution {
  strategy: ConflictResolutionStrategy;
  reason: string;
  mergeData?: any;
}

// ========== 核心管理器 ==========

/// 乐观UI更新管理器
export class OptimisticUIManager extends EventEmitter {
  private messageQueue = new Map<string, OptimisticMessage>();
  private statusSubscribers = new Map<string, Function[]>();
  private timingPredictor: MessageTimingPredictor;
  private conflictResolver: MessageConflictResolver;
  private retryScheduler: RetryScheduler;
  private performanceMonitor: PerformanceMonitor;

  // 配置参数
  private readonly config = {
    maxUIResponseTime: 50, // 50ms UI响应时间
    maxQueueSize: 1000,
    cleanupInterval: 60000, // 1分钟清理一次
    defaultRetryCount: 3,
    defaultTimeout: 30000, // 30秒超时
  };

  constructor() {
    super();
    this.timingPredictor = new MessageTimingPredictor();
    this.conflictResolver = new MessageConflictResolver();
    this.retryScheduler = new RetryScheduler();
    this.performanceMonitor = new PerformanceMonitor();

    // 启动定期清理
    this.startPeriodicCleanup();
  }

  /// 发送消息（乐观更新）
  async sendMessageOptimistic(
    receiver: string | null, // null表示群组消息
    groupId: string | null,
    content: string,
    options: OptimisticOptions = {}
  ): Promise<OptimisticResult> {
    const startTime = performance.now();
    const tempId = this.generateTempId();

    try {
      // 1. 立即创建乐观消息（必须在50ms内完成）
      const optimisticMessage = this.createOptimisticMessage({
        tempId,
        sender: await this.getCurrentUser(),
        receiver: receiver || undefined,
        groupId: groupId || undefined,
        content,
        timestamp: Date.now(),
        options,
      });

      // 2. 立即显示在UI（瞬时响应）
      this.addToUIInstantly(optimisticMessage);
      this.messageQueue.set(tempId, optimisticMessage);

      // 3. 记录UI响应时间
      const uiResponseTime = performance.now() - startTime;
      this.performanceMonitor.recordUIResponse(uiResponseTime);

      // 4. 预测确认时间并显示
      const timingPrediction = await this.timingPredictor.predict(content, receiver || groupId);
      this.updateEstimatedTime(tempId, timingPrediction);

      // 5. 启动异步处理（不阻塞UI）
      const confirmationPromise = this.processMessageAsync(tempId);

      return {
        tempId,
        promise: confirmationPromise,
        estimatedTime: timingPrediction.totalTime,
      };

    } catch (error) {
      const errorTime = performance.now() - startTime;
      this.performanceMonitor.recordError('UI_CREATION_FAILED', errorTime);
      throw new Error(`乐观UI创建失败: ${error.message}`);
    }
  }

  /// 创建乐观消息
  private createOptimisticMessage(params: {
    tempId: string;
    sender: string;
    receiver?: string;
    groupId?: string;
    content: string;
    timestamp: number;
    options: OptimisticOptions;
  }): OptimisticMessage {
    const { tempId, sender, receiver, groupId, content, timestamp, options } = params;

    return {
      tempId,
      sender,
      receiver,
      groupId,
      content,
      timestamp,
      status: 'pending',
      progress: 0,
      stage: ProcessingStage.STARTING,
      retryCount: 0,
      maxRetries: options.maxRetries || this.config.defaultRetryCount,
      estimatedConfirmTime: options.customEstimatedTime || 5000,
      canCancel: true,
      canRetry: options.enableRetry !== false,
      animationState: 'enter',
    };
  }

  /// 立即添加到UI
  private addToUIInstantly(message: OptimisticMessage): void {
    // 触发UI更新事件
    this.emit('messageAdded', message);

    // 触发动画
    setTimeout(() => {
      message.animationState = 'normal';
      this.emit('messageUpdated', message);
    }, 100);
  }

  /// 异步处理消息上链
  private async processMessageAsync(tempId: string): Promise<string> {
    const message = this.messageQueue.get(tempId);
    if (!message) {
      throw new Error(`消息 ${tempId} 不存在`);
    }

    try {
      // 阶段1: 加密
      this.updateProgress(tempId, ProcessingStage.ENCRYPTING, 0);
      const encrypted = await this.encryptWithProgress(
        message.content,
        (progress) => this.updateProgress(tempId, ProcessingStage.ENCRYPTING, progress * 30)
      );

      // 阶段2: IPFS上传
      this.updateProgress(tempId, ProcessingStage.UPLOADING_IPFS, 30);
      const cid = await this.uploadToIPFSWithProgress(
        encrypted,
        (progress) => this.updateProgress(tempId, ProcessingStage.UPLOADING_IPFS, 30 + progress * 40)
      );

      // 阶段3: 提交交易
      this.updateProgress(tempId, ProcessingStage.SUBMITTING_TRANSACTION, 70);
      const realMessageId = await this.submitTransaction(message, cid, (progress) => {
        this.updateProgress(tempId, ProcessingStage.WAITING_CONFIRMATION, 70 + progress * 25);
      });

      // 阶段4: 最终确认
      this.updateProgress(tempId, ProcessingStage.FINALIZING, 95);
      await this.finalizeMessage(tempId, realMessageId);
      this.updateProgress(tempId, ProcessingStage.COMPLETED, 100);

      return realMessageId;

    } catch (error) {
      await this.handleProcessingError(tempId, error);
      throw error;
    }
  }

  /// 加密处理（带进度）
  private async encryptWithProgress(
    content: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.1;
        onProgress(Math.min(progress, 1.0));

        if (progress >= 1.0) {
          clearInterval(interval);
          // 模拟加密结果
          resolve(`encrypted_${Date.now()}_${content.substring(0, 10)}`);
        }
      }, 20); // 每20ms更新一次进度

      // 模拟加密可能失败
      if (Math.random() < 0.05) { // 5% 失败率
        setTimeout(() => {
          clearInterval(interval);
          reject(new Error('加密失败'));
        }, 100);
      }
    });
  }

  /// IPFS上传（带进度）
  private async uploadToIPFSWithProgress(
    content: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.05;
        onProgress(Math.min(progress, 1.0));

        if (progress >= 1.0) {
          clearInterval(interval);
          // 模拟IPFS CID
          const hash = this.simpleHash(content);
          resolve(`Qm${hash.substring(0, 44)}`);
        }
      }, 50); // 每50ms更新一次进度

      // 模拟IPFS可能失败
      if (Math.random() < 0.03) { // 3% 失败率
        setTimeout(() => {
          clearInterval(interval);
          reject(new Error('IPFS上传失败'));
        }, 500);
      }
    });
  }

  /// 提交交易
  private async submitTransaction(
    message: OptimisticMessage,
    cid: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    try {
      // 真实的区块链调用
      if (!message.groupId) {
        throw new Error('群组ID不能为空');
      }

      // 调用 smartChatService 发送群组消息（使用地址签名）
      console.log('正在提交消息到区块链...', {
        groupId: message.groupId,
        content: message.content,
        tempId: message.tempId,
        sender: message.sender,
      });

      // 模拟进度更新（区块链交易需要时间）
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(currentProgress + 0.05, 0.9);
        onProgress(currentProgress); // 最多到90%
      }, 200);

      const realMessageId = await smartChatService.sendGroupMessageWithAddress(
        message.sender,
        message.groupId,
        message.content,
        'Text',
        message.tempId
      );

      clearInterval(progressInterval);
      onProgress(1.0); // 完成

      console.log('消息已成功提交到区块链，消息ID:', realMessageId);
      return realMessageId;

    } catch (error) {
      console.error('提交交易失败:', error);
      throw new Error(`交易提交失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /// 最终确认处理
  private async finalizeMessage(tempId: string, realMessageId: string): Promise<void> {
    const message = this.messageQueue.get(tempId);
    if (!message) return;

    // 更新消息状态
    message.realId = realMessageId;
    message.status = 'confirmed';
    message.actualConfirmTime = Date.now();
    message.animationState = 'confirmed';
    message.canCancel = false;

    // 记录性能数据
    const totalTime = message.actualConfirmTime - message.timestamp;
    this.performanceMonitor.recordConfirmation(tempId, totalTime);

    // 触发确认事件
    this.emit('messageConfirmed', message);

    // 3秒后移除临时标记
    setTimeout(() => {
      message.animationState = 'normal';
      this.emit('messageUpdated', message);
    }, 3000);
  }

  /// 智能重试策略
  private async handleProcessingError(tempId: string, error: any): Promise<void> {
    const message = this.messageQueue.get(tempId);
    if (!message) return;

    // 分析错误类型
    const errorAnalysis = this.analyzeError(error);

    // 决定重试策略
    const shouldRetry = this.shouldRetryMessage(message, errorAnalysis);

    if (shouldRetry && message.retryCount < message.maxRetries) {
      // 智能重试
      message.retryCount++;
      message.status = 'retrying';
      message.animationState = 'updating';

      // 指数退避 + 抖动
      const baseDelay = Math.pow(2, message.retryCount) * 1000;
      const jitter = Math.random() * 500;
      const retryDelay = baseDelay + jitter;

      // 显示重试倒计时
      this.showRetryCountdown(tempId, retryDelay);
      this.emit('messageUpdated', message);

      // 安排重试
      setTimeout(() => {
        this.processMessageAsync(tempId).catch(retryError => {
          this.handleProcessingError(tempId, retryError);
        });
      }, retryDelay);

    } else {
      // 最终失败
      this.handleFinalFailure(tempId, errorAnalysis);
    }
  }

  /// 错误分析
  private analyzeError(error: any): ErrorAnalysis {
    return {
      type: this.classifyErrorType(error),
      severity: this.calculateErrorSeverity(error),
      retryable: this.isErrorRetryable(error),
      userActionRequired: this.requiresUserAction(error),
      estimatedRecoveryTime: this.estimateRecoveryTime(error),
    };
  }

  /// 错误类型分类
  private classifyErrorType(error: any): ErrorType {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('network') || message.includes('连接')) {
      return ErrorType.NETWORK_ERROR;
    } else if (message.includes('encrypt') || message.includes('加密')) {
      return ErrorType.ENCRYPTION_ERROR;
    } else if (message.includes('ipfs') || message.includes('上传')) {
      return ErrorType.IPFS_ERROR;
    } else if (message.includes('transaction') || message.includes('交易')) {
      return ErrorType.TRANSACTION_ERROR;
    } else {
      return ErrorType.UNKNOWN_ERROR;
    }
  }

  /// 计算错误严重程度
  private calculateErrorSeverity(error: any): number {
    // 返回0-1之间的严重程度
    const message = error.message?.toLowerCase() || '';

    if (message.includes('critical') || message.includes('fatal')) {
      return 1.0;
    } else if (message.includes('error')) {
      return 0.7;
    } else if (message.includes('warning')) {
      return 0.3;
    } else {
      return 0.5;
    }
  }

  /// 判断错误是否可重试
  private isErrorRetryable(error: any): boolean {
    const message = error.message?.toLowerCase() || '';

    // 网络错误通常可重试
    if (message.includes('network') || message.includes('timeout')) {
      return true;
    }

    // 加密错误通常不可重试
    if (message.includes('encrypt') || message.includes('decrypt')) {
      return false;
    }

    // IPFS错误可重试
    if (message.includes('ipfs')) {
      return true;
    }

    // 默认可重试
    return true;
  }

  /// 是否需要用户操作
  private requiresUserAction(error: any): boolean {
    const message = error.message?.toLowerCase() || '';

    return message.includes('permission') ||
           message.includes('authentication') ||
           message.includes('权限') ||
           message.includes('认证');
  }

  /// 估计恢复时间
  private estimateRecoveryTime(error: any): number {
    const errorType = this.classifyErrorType(error);

    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        return 5000; // 5秒
      case ErrorType.IPFS_ERROR:
        return 10000; // 10秒
      case ErrorType.TRANSACTION_ERROR:
        return 15000; // 15秒
      default:
        return 8000; // 8秒
    }
  }

  /// 判断是否应该重试
  private shouldRetryMessage(message: OptimisticMessage, errorAnalysis: ErrorAnalysis): boolean {
    // 检查重试次数
    if (message.retryCount >= message.maxRetries) {
      return false;
    }

    // 检查错误是否可重试
    if (!errorAnalysis.retryable) {
      return false;
    }

    // 检查是否需要用户操作
    if (errorAnalysis.userActionRequired) {
      return false;
    }

    return true;
  }

  /// 显示重试倒计时
  private showRetryCountdown(tempId: string, delay: number): void {
    const message = this.messageQueue.get(tempId);
    if (!message) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, delay - elapsed);

      if (remaining <= 0) {
        clearInterval(interval);
        message.errorInfo = undefined;
      } else {
        const seconds = Math.ceil(remaining / 1000);
        message.errorInfo = `将在${seconds}秒后重试...`;
      }

      this.emit('messageUpdated', message);
    }, 100);
  }

  /// 处理最终失败
  private handleFinalFailure(tempId: string, errorAnalysis: ErrorAnalysis): void {
    const message = this.messageQueue.get(tempId);
    if (!message) return;

    message.status = 'failed';
    message.animationState = 'error';
    message.errorInfo = this.generateUserFriendlyError(errorAnalysis);
    message.canRetry = errorAnalysis.retryable && !errorAnalysis.userActionRequired;
    message.canCancel = true;

    this.emit('messageUpdated', message);

    // 记录失败指标
    this.performanceMonitor.recordFailure(tempId, errorAnalysis);
  }

  /// 生成用户友好的错误信息
  private generateUserFriendlyError(errorAnalysis: ErrorAnalysis): string {
    switch (errorAnalysis.type) {
      case ErrorType.NETWORK_ERROR:
        return '网络连接异常，请检查网络设置';
      case ErrorType.ENCRYPTION_ERROR:
        return '消息加密失败，请重试';
      case ErrorType.IPFS_ERROR:
        return '文件上传失败，请重试';
      case ErrorType.TRANSACTION_ERROR:
        return '交易提交失败，可能是网络拥堵';
      default:
        return '发送失败，请重试';
    }
  }

  /// 处理状态更新
  private updateProgress(
    tempId: string,
    stage: ProcessingStage,
    progress: number
  ): void {
    const message = this.messageQueue.get(tempId);
    if (!message) return;

    message.stage = stage;
    message.progress = Math.max(message.progress, progress); // 进度只能前进
    message.status = this.stageToStatus(stage);

    // 更新动画状态
    if (progress > message.progress) {
      message.animationState = 'updating';
    }

    // 触发更新事件
    this.emit('messageUpdated', message);

    // 触发订阅者
    this.notifySubscribers(tempId, message);
  }

  /// 阶段转状态
  private stageToStatus(stage: ProcessingStage): MessageStatus {
    switch (stage) {
      case ProcessingStage.STARTING:
        return 'pending';
      case ProcessingStage.ENCRYPTING:
        return 'encrypting';
      case ProcessingStage.UPLOADING_IPFS:
        return 'uploading';
      case ProcessingStage.SUBMITTING_TRANSACTION:
      case ProcessingStage.WAITING_CONFIRMATION:
        return 'submitting';
      case ProcessingStage.FINALIZING:
        return 'submitting';
      case ProcessingStage.COMPLETED:
        return 'confirmed';
      case ProcessingStage.FAILED:
        return 'failed';
      default:
        return 'pending';
    }
  }

  /// 通知订阅者
  private notifySubscribers(tempId: string, message: OptimisticMessage): void {
    const subscribers = this.statusSubscribers.get(tempId) || [];
    subscribers.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('订阅者回调执行失败:', error);
      }
    });
  }

  /// 消息冲突处理
  async resolveMessageConflict(
    tempMessage: OptimisticMessage,
    realMessage: any
  ): Promise<void> {
    const resolution = await this.conflictResolver.resolve(tempMessage, realMessage);

    switch (resolution.strategy) {
      case ConflictResolutionStrategy.USE_CHAIN_MESSAGE:
        // 使用链上消息，更新UI
        this.replaceOptimisticMessage(tempMessage.tempId, realMessage);
        break;

      case ConflictResolutionStrategy.MERGE_MESSAGES:
        // 合并消息内容
        this.mergeMessages(tempMessage.tempId, realMessage, resolution.mergeData);
        break;

      case ConflictResolutionStrategy.KEEP_OPTIMISTIC:
        // 保持乐观消息，标记为冲突
        this.markAsConflicted(tempMessage.tempId, resolution.reason);
        break;

      case ConflictResolutionStrategy.USER_DECISION:
        // 让用户决定
        this.promptUserForResolution(tempMessage.tempId, realMessage, resolution);
        break;
    }
  }

  /// 替换乐观消息
  private replaceOptimisticMessage(tempId: string, realMessage: any): void {
    const message = this.messageQueue.get(tempId);
    if (!message) return;

    // 保留乐观消息的UI状态，更新为链上内容
    Object.assign(message, {
      realId: realMessage.id,
      content: realMessage.content,
      status: 'confirmed',
      progress: 100,
      stage: ProcessingStage.COMPLETED,
      animationState: 'confirmed',
    });

    this.emit('messageReplaced', message);
  }

  /// 合并消息
  private mergeMessages(tempId: string, realMessage: any, mergeData: any): void {
    // 实现消息合并逻辑
    console.log('合并消息:', { tempId, realMessage, mergeData });
  }

  /// 标记为冲突
  private markAsConflicted(tempId: string, reason: string): void {
    const message = this.messageQueue.get(tempId);
    if (!message) return;

    message.status = 'failed';
    message.errorInfo = `消息冲突: ${reason}`;
    message.animationState = 'error';

    this.emit('messageConflicted', message);
  }

  /// 提示用户解决冲突
  private promptUserForResolution(
    tempId: string,
    realMessage: any,
    resolution: ConflictResolution
  ): void {
    this.emit('userResolutionRequired', {
      tempId,
      realMessage,
      resolution,
      tempMessage: this.messageQueue.get(tempId),
    });
  }

  // ========== 工具方法 ==========

  /// 生成临时ID
  private generateTempId(): string {
    return uuidv4();
  }

  /// 获取当前用户
  private async getCurrentUser(): Promise<string> {
    // 从 localStorage 获取当前用户地址
    const { getCurrentAddress } = await import('./keystore');
    const address = getCurrentAddress();
    if (!address) {
      throw new Error('未找到当前用户，请先连接钱包');
    }
    return address;
  }

  /// 更新预估时间
  private updateEstimatedTime(tempId: string, prediction: TimingPrediction): void {
    const message = this.messageQueue.get(tempId);
    if (!message) return;

    message.estimatedConfirmTime = prediction.totalTime;
    this.emit('messageUpdated', message);
  }

  /// 简单哈希函数
  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /// 启动定期清理
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredMessages();
    }, this.config.cleanupInterval);
  }

  /// 清理过期消息
  private cleanupExpiredMessages(): void {
    const now = Date.now();
    const expiredMessages: string[] = [];

    this.messageQueue.forEach((message, tempId) => {
      // 清理条件：
      // 1. 已确认超过1小时
      // 2. 失败状态超过30分钟
      const age = now - message.timestamp;
      const shouldCleanup =
        (message.status === 'confirmed' && age > 3600000) ||
        (message.status === 'failed' && age > 1800000);

      if (shouldCleanup) {
        expiredMessages.push(tempId);
      }
    });

    // 清理过期消息
    expiredMessages.forEach(tempId => {
      this.messageQueue.delete(tempId);
      this.statusSubscribers.delete(tempId);
    });

    if (expiredMessages.length > 0) {
      this.emit('messagesCleanedUp', expiredMessages);
    }
  }

  // ========== 公共API ==========

  /// 订阅消息状态变化
  subscribeToMessage(tempId: string, callback: (message: OptimisticMessage) => void): () => void {
    if (!this.statusSubscribers.has(tempId)) {
      this.statusSubscribers.set(tempId, []);
    }
    this.statusSubscribers.get(tempId)!.push(callback);

    // 返回取消订阅函数
    return () => {
      const subscribers = this.statusSubscribers.get(tempId);
      if (subscribers) {
        const index = subscribers.indexOf(callback);
        if (index > -1) {
          subscribers.splice(index, 1);
        }
      }
    };
  }

  /// 获取消息状态
  getMessageStatus(tempId: string): OptimisticMessage | undefined {
    return this.messageQueue.get(tempId);
  }

  /// 取消消息发送
  cancelMessage(tempId: string): boolean {
    const message = this.messageQueue.get(tempId);
    if (!message || !message.canCancel) {
      return false;
    }

    message.status = 'failed';
    message.errorInfo = '用户取消';
    message.animationState = 'error';
    message.canRetry = false;

    this.emit('messageCancelled', message);
    return true;
  }

  /// 重试消息发送
  async retryMessage(tempId: string): Promise<OptimisticResult | null> {
    const message = this.messageQueue.get(tempId);
    if (!message || !message.canRetry) {
      return null;
    }

    // 重置状态
    message.status = 'pending';
    message.progress = 0;
    message.stage = ProcessingStage.STARTING;
    message.errorInfo = undefined;
    message.animationState = 'updating';

    this.emit('messageRetrying', message);

    // 重新处理
    const confirmationPromise = this.processMessageAsync(tempId);

    return {
      tempId,
      promise: confirmationPromise,
      estimatedTime: message.estimatedConfirmTime,
    };
  }

  /// 获取性能指标
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  /// 清空消息队列
  clearMessageQueue(): void {
    this.messageQueue.clear();
    this.statusSubscribers.clear();
    this.emit('queueCleared');
  }
}

// ========== 支持类 ==========

/// 消息时间预测器
class MessageTimingPredictor {
  private historicalData: TimingData[] = [];

  async predict(content: string, target: string | null): Promise<TimingPrediction> {
    const baseTime = this.calculateBaseTime(content);
    const networkFactor = await this.estimateNetworkCondition();
    const complexityFactor = this.calculateComplexityFactor(content);

    const stages = {
      [ProcessingStage.ENCRYPTING]: baseTime * 0.2 * complexityFactor,
      [ProcessingStage.UPLOADING_IPFS]: baseTime * 0.4 * networkFactor,
      [ProcessingStage.SUBMITTING_TRANSACTION]: baseTime * 0.3 * networkFactor,
      [ProcessingStage.WAITING_CONFIRMATION]: baseTime * 0.1,
    };

    const totalTime = Object.values(stages).reduce((sum, time) => sum + time, 0);
    const confidence = this.calculatePredictionConfidence(totalTime);

    return {
      totalTime,
      stages,
      confidence,
    };
  }

  private calculateBaseTime(content: string): number {
    // 基础时间计算，考虑内容长度
    const baseTime = 2000; // 2秒基础时间
    const lengthFactor = Math.min(content.length / 1000, 3); // 最多3倍
    return baseTime * (1 + lengthFactor);
  }

  private async estimateNetworkCondition(): Promise<number> {
    // 简化的网络状况估算
    // 实际实现中应该检测网络延迟和带宽
    return 1.0; // 返回1.0表示正常网络
  }

  private calculateComplexityFactor(content: string): number {
    // 内容复杂度因子
    let factor = 1.0;

    // 检查是否包含特殊字符（可能需要更复杂的加密）
    if (/[^\x00-\x7F]/.test(content)) {
      factor *= 1.2; // 非ASCII字符增加20%时间
    }

    // 检查是否包含URL（可能需要额外处理）
    if (/https?:\/\//.test(content)) {
      factor *= 1.1;
    }

    return factor;
  }

  private calculatePredictionConfidence(totalTime: number): number {
    // 基于历史数据计算置信度
    if (this.historicalData.length < 10) {
      return 0.6; // 数据不足时的默认置信度
    }

    // 计算历史预测准确性
    const accuracyScores = this.historicalData.map(data => {
      const error = Math.abs(data.actual - data.predicted) / data.predicted;
      return Math.max(0, 1 - error);
    });

    return accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length;
  }

  /// 记录实际时间数据
  recordActualTime(predicted: number, actual: number): void {
    this.historicalData.push({
      predicted,
      actual,
      timestamp: Date.now(),
    });

    // 只保留最近100条记录
    if (this.historicalData.length > 100) {
      this.historicalData.shift();
    }
  }
}

/// 消息冲突解决器
class MessageConflictResolver {
  async resolve(
    tempMessage: OptimisticMessage,
    realMessage: any
  ): Promise<ConflictResolution> {
    // 检查消息是否一致
    if (this.messagesAreEquivalent(tempMessage, realMessage)) {
      return {
        strategy: ConflictResolutionStrategy.USE_CHAIN_MESSAGE,
        reason: '消息内容一致，使用链上版本',
      };
    }

    // 检查是否可以合并
    if (this.canMergeMessages(tempMessage, realMessage)) {
      return {
        strategy: ConflictResolutionStrategy.MERGE_MESSAGES,
        reason: '消息可以合并',
        mergeData: this.generateMergeData(tempMessage, realMessage),
      };
    }

    // 检查乐观消息是否更新
    if (this.isOptimisticMessageNewer(tempMessage, realMessage)) {
      return {
        strategy: ConflictResolutionStrategy.KEEP_OPTIMISTIC,
        reason: '本地版本更新',
      };
    }

    // 默认需要用户决定
    return {
      strategy: ConflictResolutionStrategy.USER_DECISION,
      reason: '消息冲突，需要用户选择',
    };
  }

  private messagesAreEquivalent(
    tempMessage: OptimisticMessage,
    realMessage: any
  ): boolean {
    return tempMessage.content === realMessage.content &&
           tempMessage.sender === realMessage.sender;
  }

  private canMergeMessages(
    tempMessage: OptimisticMessage,
    realMessage: any
  ): boolean {
    // 简化的合并检查逻辑
    return tempMessage.sender === realMessage.sender;
  }

  private generateMergeData(
    tempMessage: OptimisticMessage,
    realMessage: any
  ): any {
    return {
      content: realMessage.content,
      metadata: tempMessage.timestamp,
    };
  }

  private isOptimisticMessageNewer(
    tempMessage: OptimisticMessage,
    realMessage: any
  ): boolean {
    return tempMessage.timestamp > (realMessage.timestamp || 0);
  }
}

/// 重试调度器
class RetryScheduler {
  private retryQueue = new Map<string, RetryTask>();

  scheduleRetry(
    tempId: string,
    retryFn: () => Promise<void>,
    delay: number
  ): void {
    const task: RetryTask = {
      tempId,
      retryFn,
      scheduledTime: Date.now() + delay,
      timeout: setTimeout(() => {
        retryFn().catch(console.error);
        this.retryQueue.delete(tempId);
      }, delay),
    };

    this.retryQueue.set(tempId, task);
  }

  cancelRetry(tempId: string): boolean {
    const task = this.retryQueue.get(tempId);
    if (task) {
      clearTimeout(task.timeout);
      this.retryQueue.delete(tempId);
      return true;
    }
    return false;
  }

  getPendingRetries(): string[] {
    return Array.from(this.retryQueue.keys());
  }
}

/// 性能监控器
class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    uiResponseTimes: [],
    confirmationTimes: [],
    errorCounts: new Map(),
    successRate: 0,
    averageConfirmationTime: 0,
  };

  recordUIResponse(responseTime: number): void {
    this.metrics.uiResponseTimes.push(responseTime);

    // 只保留最近100条记录
    if (this.metrics.uiResponseTimes.length > 100) {
      this.metrics.uiResponseTimes.shift();
    }
  }

  recordConfirmation(tempId: string, confirmationTime: number): void {
    this.metrics.confirmationTimes.push(confirmationTime);

    // 更新平均确认时间
    this.updateAverageConfirmationTime();

    // 更新成功率
    this.updateSuccessRate();
  }

  recordError(errorType: string, processingTime: number): void {
    const count = this.metrics.errorCounts.get(errorType) || 0;
    this.metrics.errorCounts.set(errorType, count + 1);

    // 更新成功率
    this.updateSuccessRate();
  }

  recordFailure(tempId: string, errorAnalysis: ErrorAnalysis): void {
    this.recordError(errorAnalysis.type, 0);
  }

  private updateAverageConfirmationTime(): void {
    if (this.metrics.confirmationTimes.length === 0) {
      this.metrics.averageConfirmationTime = 0;
      return;
    }

    const sum = this.metrics.confirmationTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageConfirmationTime = sum / this.metrics.confirmationTimes.length;
  }

  private updateSuccessRate(): void {
    const totalConfirmations = this.metrics.confirmationTimes.length;
    const totalErrors = Array.from(this.metrics.errorCounts.values())
      .reduce((sum, count) => sum + count, 0);
    const totalAttempts = totalConfirmations + totalErrors;

    if (totalAttempts === 0) {
      this.metrics.successRate = 0;
    } else {
      this.metrics.successRate = totalConfirmations / totalAttempts;
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      uiResponseTimes: [],
      confirmationTimes: [],
      errorCounts: new Map(),
      successRate: 0,
      averageConfirmationTime: 0,
    };
  }
}

// ========== 接口定义 ==========

interface TimingData {
  predicted: number;
  actual: number;
  timestamp: number;
}

interface RetryTask {
  tempId: string;
  retryFn: () => Promise<void>;
  scheduledTime: number;
  timeout: NodeJS.Timeout;
}

interface ErrorAnalysis {
  type: ErrorType;
  severity: number;
  retryable: boolean;
  userActionRequired: boolean;
  estimatedRecoveryTime: number;
}

enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  IPFS_ERROR = 'IPFS_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

interface PerformanceMetrics {
  uiResponseTimes: number[];
  confirmationTimes: number[];
  errorCounts: Map<string, number>;
  successRate: number;
  averageConfirmationTime: number;
}

// 默认导出
export default OptimisticUIManager;