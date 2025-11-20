/// Stardust智能群聊 - 乐观UI消息组件
///
/// 提供50ms瞬时响应的聊天消息UI组件

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Badge, Progress, Button, Tooltip, Spin, Alert } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  LockOutlined,
  CloudUploadOutlined,
  GlobalOutlined,
  RetryOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import OptimisticUIManager, {
  OptimisticMessage,
  MessageStatus,
  ProcessingStage,
} from '../../lib/optimistic-ui-manager';

// ========== 类型定义 ==========

interface OptimisticMessageProps {
  message: OptimisticMessage;
  onRetry?: (tempId: string) => void;
  onCancel?: (tempId: string) => void;
  showProgress?: boolean;
  compact?: boolean;
}

interface MessageListProps {
  groupId?: string;
  currentUser: string;
  optimisticManager: OptimisticUIManager;
  messages?: OptimisticMessage[];
}

interface SendMessageProps {
  groupId?: string;
  receiver?: string;
  optimisticManager: OptimisticUIManager;
  onMessageSent?: (tempId: string) => void;
  placeholder?: string;
  maxLength?: number;
}

// ========== 乐观消息组件 ==========

export const OptimisticMessageComponent: React.FC<OptimisticMessageProps> = ({
  message,
  onRetry,
  onCancel,
  showProgress = true,
  compact = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // 获取消息样式类
  const getMessageClasses = useCallback(() => {
    const baseClasses = [
      'optimistic-message',
      'p-3',
      'mb-2',
      'rounded-lg',
      'transition-all',
      'duration-300',
    ];

    // 状态样式
    switch (message.status) {
      case 'pending':
        baseClasses.push('bg-gray-50', 'border-l-4', 'border-gray-300', 'opacity-70');
        break;
      case 'encrypting':
        baseClasses.push('bg-blue-50', 'border-l-4', 'border-blue-300');
        break;
      case 'uploading':
        baseClasses.push('bg-purple-50', 'border-l-4', 'border-purple-300');
        break;
      case 'submitting':
        baseClasses.push('bg-green-50', 'border-l-4', 'border-green-300');
        break;
      case 'confirmed':
        baseClasses.push('bg-white', 'border', 'border-green-200', 'opacity-100');
        break;
      case 'failed':
        baseClasses.push('bg-red-50', 'border', 'border-red-300');
        break;
      case 'retrying':
        baseClasses.push('bg-yellow-50', 'border-l-4', 'border-yellow-300');
        break;
    }

    // 动画状态
    switch (message.animationState) {
      case 'enter':
        baseClasses.push('animate-slideUp');
        break;
      case 'updating':
        baseClasses.push('animate-pulse-subtle');
        break;
      case 'confirmed':
        baseClasses.push('animate-confirm-flash');
        break;
      case 'error':
        baseClasses.push('animate-shake');
        break;
    }

    return baseClasses.join(' ');
  }, [message.status, message.animationState]);

  // 渲染状态指示器
  const renderStatusIndicator = () => {
    switch (message.status) {
      case 'pending':
        return (
          <Tooltip title="等待处理">
            <ClockCircleOutlined className="text-gray-400" />
          </Tooltip>
        );

      case 'encrypting':
        return (
          <div className="flex items-center space-x-2">
            <Tooltip title="加密中">
              <LockOutlined className="text-blue-500 animate-pulse" />
            </Tooltip>
            {showProgress && (
              <Progress
                percent={Math.round(message.progress)}
                size="small"
                strokeColor="#3b82f6"
                showInfo={false}
                className="w-16"
              />
            )}
          </div>
        );

      case 'uploading':
        return (
          <div className="flex items-center space-x-2">
            <Tooltip title="上传中">
              <CloudUploadOutlined className="text-purple-500 animate-bounce" />
            </Tooltip>
            {showProgress && (
              <Progress
                percent={Math.round(message.progress)}
                size="small"
                strokeColor="#8b5cf6"
                showInfo={false}
                className="w-16"
              />
            )}
          </div>
        );

      case 'submitting':
        return (
          <div className="flex items-center space-x-2">
            <Tooltip title="上链中">
              <Spin indicator={<LoadingOutlined className="text-green-500" spin />} />
            </Tooltip>
            <span className="text-xs text-green-600">
              {message.stage === ProcessingStage.WAITING_CONFIRMATION ? '等待确认...' : '提交中...'}
            </span>
          </div>
        );

      case 'confirmed':
        return (
          <Tooltip title="已确认">
            <CheckCircleOutlined className="text-green-500" />
          </Tooltip>
        );

      case 'failed':
        return (
          <div className="flex items-center space-x-2">
            <Tooltip title={message.errorInfo || '发送失败'}>
              <ExclamationCircleOutlined className="text-red-500" />
            </Tooltip>
            {message.canRetry && (
              <Button
                type="link"
                size="small"
                icon={<RetryOutlined />}
                onClick={() => onRetry?.(message.tempId)}
                className="text-red-600 hover:text-red-700 p-0"
              >
                重试
              </Button>
            )}
          </div>
        );

      case 'retrying':
        return (
          <div className="flex items-center space-x-2">
            <Tooltip title="重试中">
              <Spin indicator={<RetryOutlined className="text-yellow-500" spin />} />
            </Tooltip>
            <span className="text-xs text-yellow-600">
              {message.errorInfo || '重试中...'}
            </span>
          </div>
        );

      default:
        return null;
    }
  };

  // 渲染进度详情
  const renderProgressDetails = () => {
    if (!showProgress || message.status === 'confirmed') return null;

    const stageTexts = {
      [ProcessingStage.STARTING]: '准备发送',
      [ProcessingStage.ENCRYPTING]: '加密消息',
      [ProcessingStage.UPLOADING_IPFS]: '上传文件',
      [ProcessingStage.SUBMITTING_TRANSACTION]: '提交交易',
      [ProcessingStage.WAITING_CONFIRMATION]: '等待确认',
      [ProcessingStage.FINALIZING]: '最终处理',
      [ProcessingStage.COMPLETED]: '发送完成',
      [ProcessingStage.FAILED]: '发送失败',
    };

    return (
      <div className="mt-2 text-xs">
        <div className="flex justify-between text-gray-500 mb-1">
          <span>{stageTexts[message.stage] || '处理中'}</span>
          <span>{Math.round(message.progress)}%</span>
        </div>
        <Progress
          percent={message.progress}
          size="small"
          strokeColor={
            message.status === 'failed' ? '#ef4444' :
            message.status === 'retrying' ? '#f59e0b' :
            '#10b981'
          }
          showInfo={false}
        />
        {message.estimatedConfirmTime > 0 && message.status !== 'confirmed' && (
          <div className="text-gray-400 mt-1">
            预计还需 {Math.ceil((message.estimatedConfirmTime - message.progress * message.estimatedConfirmTime / 100) / 1000)}秒
          </div>
        )}
      </div>
    );
  };

  // 渲染操作按钮
  const renderActionButtons = () => {
    if (compact || message.status === 'confirmed') return null;

    return (
      <div className="flex space-x-2 mt-2">
        {message.canCancel && (
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => onCancel?.(message.tempId)}
            className="text-gray-500 hover:text-gray-700"
          >
            取消
          </Button>
        )}
        {showDetails && (
          <Button
            type="text"
            size="small"
            onClick={() => setShowDetails(!showDetails)}
            className="text-blue-500 hover:text-blue-700"
          >
            {showDetails ? '隐藏详情' : '显示详情'}
          </Button>
        )}
      </div>
    );
  };

  // 渲染详细信息
  const renderDetails = () => {
    if (!showDetails) return null;

    return (
      <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <strong>临时ID:</strong> {message.tempId.substring(0, 8)}...
          </div>
          {message.realId && (
            <div>
              <strong>链上ID:</strong> {message.realId.substring(0, 8)}...
            </div>
          )}
          <div>
            <strong>发送时间:</strong> {new Date(message.timestamp).toLocaleTimeString()}
          </div>
          <div>
            <strong>重试次数:</strong> {message.retryCount}/{message.maxRetries}
          </div>
          {message.actualConfirmTime && (
            <div className="col-span-2">
              <strong>确认用时:</strong> {(message.actualConfirmTime - message.timestamp) / 1000}秒
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={getMessageClasses()}>
      <div className="flex justify-between items-start">
        {/* 消息内容 */}
        <div className="flex-1 mr-3">
          <div className="flex items-center space-x-2 mb-1">
            <Badge
              count={message.sender.substring(0, 8)}
              style={{ backgroundColor: '#52c41a' }}
              size="small"
            />
            <span className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-gray-800 leading-relaxed">
            {message.content}
          </div>
          {message.errorInfo && (
            <Alert
              message={message.errorInfo}
              type="error"
              size="small"
              className="mt-2"
              showIcon
            />
          )}
        </div>

        {/* 状态指示器 */}
        <div className="flex flex-col items-end space-y-1">
          {renderStatusIndicator()}
        </div>
      </div>

      {/* 进度详情 */}
      {renderProgressDetails()}

      {/* 操作按钮 */}
      {renderActionButtons()}

      {/* 详细信息 */}
      {renderDetails()}
    </div>
  );
};

// ========== 消息列表组件 ==========

export const OptimisticMessageList: React.FC<MessageListProps> = ({
  groupId,
  currentUser,
  optimisticManager,
  messages: propMessages,
}) => {
  const [messages, setMessages] = useState<OptimisticMessage[]>(propMessages || []);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 监听乐观消息更新
  useEffect(() => {
    const handleMessageAdded = (message: OptimisticMessage) => {
      if (message.groupId === groupId || message.receiver === currentUser) {
        setMessages(prev => [...prev, message]);
      }
    };

    const handleMessageUpdated = (message: OptimisticMessage) => {
      setMessages(prev => prev.map(msg =>
        msg.tempId === message.tempId ? message : msg
      ));
    };

    const handleMessageConfirmed = (message: OptimisticMessage) => {
      setMessages(prev => prev.map(msg =>
        msg.tempId === message.tempId ? { ...message, animationState: 'confirmed' } : msg
      ));

      // 3秒后恢复正常状态
      setTimeout(() => {
        setMessages(prev => prev.map(msg =>
          msg.tempId === message.tempId ? { ...message, animationState: 'normal' } : msg
        ));
      }, 3000);
    };

    optimisticManager.on('messageAdded', handleMessageAdded);
    optimisticManager.on('messageUpdated', handleMessageUpdated);
    optimisticManager.on('messageConfirmed', handleMessageConfirmed);

    return () => {
      optimisticManager.off('messageAdded', handleMessageAdded);
      optimisticManager.off('messageUpdated', handleMessageUpdated);
      optimisticManager.off('messageConfirmed', handleMessageConfirmed);
    };
  }, [optimisticManager, groupId, currentUser]);

  // 自动滚动到底部
  useEffect(() => {
    if (isAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAutoScroll]);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
      setIsAutoScroll(isAtBottom);
    }
  }, []);

  // 重试消息
  const handleRetry = useCallback(async (tempId: string) => {
    try {
      await optimisticManager.retryMessage(tempId);
    } catch (error) {
      console.error('重试失败:', error);
    }
  }, [optimisticManager]);

  // 取消消息
  const handleCancel = useCallback((tempId: string) => {
    optimisticManager.cancelMessage(tempId);
  }, [optimisticManager]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-2"
      onScroll={handleScroll}
    >
      {messages.map((message) => (
        <OptimisticMessageComponent
          key={message.tempId}
          message={message}
          onRetry={handleRetry}
          onCancel={handleCancel}
          showProgress={true}
        />
      ))}
      <div ref={messagesEndRef} />

      {!isAutoScroll && (
        <Button
          type="primary"
          shape="circle"
          icon={<GlobalOutlined />}
          className="fixed bottom-20 right-4 z-10"
          onClick={() => {
            setIsAutoScroll(true);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
};

// ========== 发送消息组件 ==========

export const OptimisticSendMessage: React.FC<SendMessageProps> = ({
  groupId,
  receiver,
  optimisticManager,
  onMessageSent,
  placeholder = "输入消息...",
  maxLength = 2000,
}) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingCount, setSendingCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!message.trim() || sending) return;

    const messageToSend = message.trim();
    setMessage('');
    setSending(true);
    setSendingCount(prev => prev + 1);

    try {
      const result = await optimisticManager.sendMessageOptimistic(
        receiver || null,
        groupId || null,
        messageToSend,
        {
          priority: 'normal',
          enableRetry: true,
          maxRetries: 3,
        }
      );

      onMessageSent?.(result.tempId);

      // 等待确认
      await result.promise;

    } catch (error) {
      console.error('发送失败:', error);
    } finally {
      setSending(false);
      setSendingCount(prev => prev - 1);
    }
  }, [message, sending, optimisticManager, receiver, groupId, onMessageSent]);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <div className="border-t bg-white p-4">
      <div className="flex space-x-3">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            style={{ maxHeight: '120px', minHeight: '44px' }}
            disabled={sending}
          />

          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
            <span>
              {message.length} / {maxLength}
            </span>
            {sendingCount > 0 && (
              <span className="text-blue-600">
                正在发送 {sendingCount} 条消息...
              </span>
            )}
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          loading={sending}
          disabled={!message.trim() || message.length > maxLength}
          onClick={handleSend}
          className="px-6"
        >
          {sending ? '发送中' : '发送'}
        </Button>
      </div>
    </div>
  );
};

// ========== CSS动画样式 ==========

const animationStyles = `
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse-subtle {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes confirm-flash {
  0% {
    background-color: rgba(34, 197, 94, 0);
  }
  50% {
    background-color: rgba(34, 197, 94, 0.1);
  }
  100% {
    background-color: rgba(34, 197, 94, 0);
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

.animate-slideUp {
  animation: slideUp 0.3s ease-out;
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
}

.animate-confirm-flash {
  animation: confirm-flash 1s ease-out;
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}
`;

// 注入样式到页面
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = animationStyles;
  document.head.appendChild(styleElement);
}

export default OptimisticUIManager;