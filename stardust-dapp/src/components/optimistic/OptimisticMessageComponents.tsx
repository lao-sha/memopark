/// Stardust智能群聊 - 乐观UI消息组件
///
/// 提供50ms瞬时响应的聊天消息UI组件

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Badge, Progress, Button, Tooltip, Spin, Alert, Modal } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  LockOutlined,
  CloudUploadOutlined,
  GlobalOutlined,
  ReloadOutlined,
  CloseOutlined,
  SmileOutlined,
  PictureOutlined,
  DeleteOutlined,
  VideoCameraOutlined,
  PlayCircleOutlined,
  AudioOutlined,
  PauseOutlined,
} from '@ant-design/icons';
import { Popover, Image } from 'antd';

// ========== 表情数据 ==========

/// 常用表情列表（按类别分组）
const EMOJI_CATEGORIES = {
  '常用': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝'],
  '情绪': ['🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮'],
  '手势': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏'],
  '心形': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❤️‍🔥', '❤️‍🩹', '💋', '💯', '💢', '💥', '💫'],
  '物品': ['🎁', '🎉', '🎊', '🎈', '🎂', '🍰', '☕', '🍵', '🍺', '🍻', '🥂', '🍾', '🍷', '🍸', '🍹', '🧃', '🌹', '🌸', '💐', '🌺', '🌻', '🌼', '🌷', '🪻', '🏵️', '🎀'],
  '动物': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺'],
};

/// 最近使用的表情（本地存储）
const getRecentEmojis = (): string[] => {
  try {
    const stored = localStorage.getItem('recent_emojis');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/// 保存最近使用的表情
const saveRecentEmoji = (emoji: string) => {
  try {
    const recent = getRecentEmojis();
    const updated = [emoji, ...recent.filter(e => e !== emoji)].slice(0, 20);
    localStorage.setItem('recent_emojis', JSON.stringify(updated));
  } catch {
    // 忽略存储错误
  }
};
import OptimisticUIManager, {
  OptimisticMessage,
  MessageStatus,
  ProcessingStage,
} from '../../lib/optimistic-ui-manager';
import { uploadToIpfs } from '../../lib/ipfs';

// ========== 类型定义 ==========

// IPFS 网关地址（本地网关，快速且无需等待传播）
const IPFS_GATEWAY = 'http://127.0.0.1:8080/ipfs/';

/// 解析消息内容，渲染图片/视频/音频
const renderMessageContent = (content: string) => {
  // 正则匹配媒体标签
  const mediaPattern = /\[(IMG|VIDEO|AUDIO):([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mediaPattern.exec(content)) !== null) {
    // 添加媒体标签之前的文本
    if (match.index > lastIndex) {
      const textBefore = content.substring(lastIndex, match.index).trim();
      if (textBefore) {
        parts.push(<span key={`text-${lastIndex}`}>{textBefore}</span>);
      }
    }

    const mediaType = match[1];
    const mediaData = match[2];

    if (mediaType === 'IMG') {
      // 图片可能有多个 CID，用逗号分隔
      const cids = mediaData.split(',').map(cid => cid.trim());
      const imageUrls = cids.map(cid => `${IPFS_GATEWAY}${cid}`);
      parts.push(
        <div key={`img-${match.index}`} className="flex flex-wrap gap-2 my-2">
          <Image.PreviewGroup
            items={imageUrls}
            preview={{
              onChange: (current) => console.log('当前预览:', current),
            }}
          >
            {cids.map((cid, idx) => (
              <Image
                key={`${cid}-${idx}`}
                src={`${IPFS_GATEWAY}${cid}`}
                alt={`图片 ${idx + 1}`}
                width={120}
                height={120}
                className="rounded-lg object-cover cursor-pointer"
                style={{ objectFit: 'cover' }}
                preview={{
                  mask: false,
                }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesACMBFIHE4oAAAAABJRU5ErkJggg=="
              />
            ))}
          </Image.PreviewGroup>
        </div>
      );
    } else if (mediaType === 'VIDEO') {
      const videoUrl = `${IPFS_GATEWAY}${mediaData}`;
      parts.push(
        <div key={`video-${match.index}`} className="my-2">
          <div
            className="relative inline-block cursor-pointer group video-preview-trigger"
            data-video-url={videoUrl}
          >
            <video
              src={videoUrl}
              className="w-[180px] h-[120px] rounded-lg object-cover bg-gray-200"
              muted
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg group-hover:bg-black/40 transition-colors">
              <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                <span className="text-gray-800 text-lg ml-0.5">▶</span>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (mediaType === 'AUDIO') {
      parts.push(
        <div key={`audio-${match.index}`} className="my-2">
          <audio
            src={`${IPFS_GATEWAY}${mediaData}`}
            controls
            className="w-full"
          />
        </div>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余的文本
  if (lastIndex < content.length) {
    const remainingText = content.substring(lastIndex).trim();
    if (remainingText) {
      parts.push(<span key={`text-end`}>{remainingText}</span>);
    }
  }

  // 如果没有匹配到媒体，直接返回原文本
  if (parts.length === 0) {
    return content;
  }

  return <>{parts}</>;
};

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
                icon={<ReloadOutlined />}
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
              <Spin indicator={<ReloadOutlined className="text-yellow-500" spin />} />
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
            {renderMessageContent(message.content)}
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
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<string>('常用');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 加载最近使用的表情
  useEffect(() => {
    setRecentEmojis(getRecentEmojis());
  }, []);

  // 清理图片预览URL
  useEffect(() => {
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  // 清理视频预览URL
  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [videoPreview]);

  // 清理音频预览URL
  useEffect(() => {
    return () => {
      if (audioPreview) URL.revokeObjectURL(audioPreview);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [audioPreview]);

  // 插入表情到消息
  const handleEmojiSelect = useCallback((emoji: string) => {
    setMessage(prev => prev + emoji);
    saveRecentEmoji(emoji);
    setRecentEmojis(getRecentEmojis());
    // 聚焦回输入框
    textareaRef.current?.focus();
  }, []);

  // 处理图片选择
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 限制最多选择9张图片
    const maxImages = 9;
    const newFiles = files.slice(0, maxImages - selectedImages.length);

    if (files.length > newFiles.length) {
      alert(`最多只能选择${maxImages}张图片`);
    }

    // 验证文件类型和大小
    const validFiles = newFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} 不是有效的图片文件`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB限制
        alert(`${file.name} 超过10MB大小限制`);
        return false;
      }
      return true;
    });

    // 生成预览
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));

    setSelectedImages(prev => [...prev, ...validFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);

    // 重置input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, [selectedImages.length]);

  // 移除已选图片
  const handleRemoveImage = useCallback((index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  }, [imagePreviews]);

  // 处理视频选择
  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('video/')) {
      alert('请选择有效的视频文件');
      return;
    }

    // 限制视频大小为50MB
    if (file.size > 50 * 1024 * 1024) {
      alert('视频大小不能超过50MB');
      return;
    }

    // 清除之前的预览
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    // 生成预览
    const preview = URL.createObjectURL(file);
    setSelectedVideo(file);
    setVideoPreview(preview);

    // 重置input
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  }, [videoPreview]);

  // 移除已选视频
  const handleRemoveVideo = useCallback(() => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setSelectedVideo(null);
    setVideoPreview(null);
  }, [videoPreview]);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioPreview(audioUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // 开始计时
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          // 最长60秒
          if (prev >= 60) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('无法访问麦克风:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  }, []);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [isRecording]);

  // 取消录音
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview);
    }
    setAudioBlob(null);
    setAudioPreview(null);
    setRecordingTime(0);
  }, [isRecording, audioPreview]);

  // 移除已录音频
  const handleRemoveAudio = useCallback(() => {
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview);
    }
    setAudioBlob(null);
    setAudioPreview(null);
    setRecordingTime(0);
  }, [audioPreview]);

  // 格式化录音时间
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 渲染表情选择器内容
  const renderEmojiPicker = () => (
    <div className="w-64 max-h-72 overflow-hidden">
      {/* 类别标签 */}
      <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-gray-100">
        {recentEmojis.length > 0 && (
          <button
            onClick={() => setEmojiCategory('最近')}
            className={`px-2 py-0.5 text-xs rounded ${
              emojiCategory === '最近'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            最近
          </button>
        )}
        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
          <button
            key={cat}
            onClick={() => setEmojiCategory(cat)}
            className={`px-2 py-0.5 text-xs rounded ${
              emojiCategory === cat
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 表情网格 */}
      <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto">
        {(emojiCategory === '最近' ? recentEmojis : EMOJI_CATEGORIES[emojiCategory as keyof typeof EMOJI_CATEGORIES] || []).map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            onClick={() => handleEmojiSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );

  // 发送消息
  const handleSend = useCallback(async () => {
    if ((!message.trim() && selectedImages.length === 0 && !selectedVideo && !audioBlob) || sending) return;

    const messageToSend = message.trim();
    const imagesToSend = [...selectedImages];
    const videoToSend = selectedVideo;
    const audioToSend = audioBlob;

    setMessage('');
    setSelectedImages([]);
    setImagePreviews([]);
    setSelectedVideo(null);
    setVideoPreview(null);
    setAudioBlob(null);
    setAudioPreview(null);
    setRecordingTime(0);
    setSending(true);
    setSendingCount(prev => prev + 1);

    try {
      // 构建消息内容
      let finalContent = messageToSend;

      // 上传图片到 IPFS
      if (imagesToSend.length > 0) {
        const imageCids: string[] = [];
        for (const file of imagesToSend) {
          try {
            const cid = await uploadToIpfs(file);
            imageCids.push(cid);
            console.log('图片上传成功, CID:', cid);
          } catch (error) {
            console.error('图片上传失败:', error);
            alert(`图片上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
          }
        }
        // 格式：[IMG:cid1,cid2,cid3]
        const imageContent = `[IMG:${imageCids.join(',')}]`;
        finalContent = finalContent ? `${finalContent}\n${imageContent}` : imageContent;
      }

      // 上传视频到 IPFS
      if (videoToSend) {
        try {
          const cid = await uploadToIpfs(videoToSend);
          console.log('视频上传成功, CID:', cid);
          // 格式：[VIDEO:cid]
          const videoContent = `[VIDEO:${cid}]`;
          finalContent = finalContent ? `${finalContent}\n${videoContent}` : videoContent;
        } catch (error) {
          console.error('视频上传失败:', error);
          alert(`视频上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
          throw error;
        }
      }

      // 上传音频到 IPFS
      if (audioToSend) {
        try {
          // 将 Blob 转换为 File
          const audioFile = new File([audioToSend], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          const cid = await uploadToIpfs(audioFile);
          console.log('音频上传成功, CID:', cid);
          // 格式：[AUDIO:cid]
          const audioContent = `[AUDIO:${cid}]`;
          finalContent = finalContent ? `${finalContent}\n${audioContent}` : audioContent;
        } catch (error) {
          console.error('音频上传失败:', error);
          alert(`音频上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
          throw error;
        }
      }

      const result = await optimisticManager.sendMessageOptimistic(
        receiver || null,
        groupId || null,
        finalContent,
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
  }, [message, selectedImages, selectedVideo, audioBlob, sending, optimisticManager, receiver, groupId, onMessageSent]);

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
    <div className="p-3 bg-white">
      {/* 图片预览区域 */}
      {imagePreviews.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative group">
              <Image
                src={preview}
                alt={`预览 ${index + 1}`}
                width={60}
                height={60}
                className="rounded-lg object-cover"
                preview={{
                  mask: '查看'
                }}
              />
              <button
                onClick={() => handleRemoveImage(index)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <DeleteOutlined />
              </button>
            </div>
          ))}
          {selectedImages.length < 9 && (
            <button
              onClick={() => imageInputRef.current?.click()}
              className="w-[60px] h-[60px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-500 transition-colors"
            >
              <PictureOutlined className="text-xl" />
            </button>
          )}
        </div>
      )}

      {/* 视频预览区域 */}
      {videoPreview && (
        <div className="mb-2">
          <div className="relative inline-block group">
            <video
              src={videoPreview}
              className="w-32 h-20 rounded-lg object-cover bg-black"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
              <PlayCircleOutlined className="text-white text-2xl" />
            </div>
            <button
              onClick={handleRemoveVideo}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <DeleteOutlined />
            </button>
            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
              {(selectedVideo!.size / 1024 / 1024).toFixed(1)}MB
            </div>
          </div>
        </div>
      )}

      {/* 录音中状态 */}
      {isRecording && (
        <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-red-600 font-medium text-sm">录音中</span>
              <span className="text-red-500 text-sm">{formatRecordingTime(recordingTime)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelRecording}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 bg-white rounded border border-gray-300"
              >
                取消
              </button>
              <button
                onClick={stopRecording}
                className="px-2 py-1 text-xs text-white bg-red-500 hover:bg-red-600 rounded"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 音频预览区域 */}
      {audioPreview && !isRecording && (
        <div className="mb-2">
          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
            <AudioOutlined className="text-green-600" />
            <audio src={audioPreview} controls className="flex-1 h-8" />
            <span className="text-xs text-green-600">{formatRecordingTime(recordingTime)}</span>
            <button
              onClick={handleRemoveAudio}
              className="p-1 text-red-500 hover:text-red-600"
            >
              <DeleteOutlined />
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* 表情按钮 */}
        <Popover
          content={renderEmojiPicker()}
          trigger="click"
          open={emojiPickerVisible}
          onOpenChange={setEmojiPickerVisible}
          placement="topLeft"
          overlayClassName="emoji-picker-popover"
        >
          <button
            className="p-2.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex-shrink-0"
            title="表情"
          >
            <SmileOutlined className="text-xl" />
          </button>
        </Popover>

        {/* 图片按钮 */}
        <button
          onClick={() => imageInputRef.current?.click()}
          className="p-2.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex-shrink-0"
          title="图片"
        >
          <PictureOutlined className="text-xl" />
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* 视频按钮 */}
        <button
          onClick={() => videoInputRef.current?.click()}
          className={`p-2.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex-shrink-0 ${selectedVideo ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="视频"
          disabled={!!selectedVideo}
        >
          <VideoCameraOutlined className="text-xl" />
        </button>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          className="hidden"
        />

        {/* 语音按钮 */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-2.5 rounded-lg transition-colors flex-shrink-0 ${
            isRecording
              ? 'text-red-500 bg-red-50 hover:bg-red-100'
              : audioBlob
                ? 'text-green-600 bg-green-50'
                : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
          }`}
          title={isRecording ? '停止录音' : '语音'}
        >
          {isRecording ? <PauseOutlined className="text-xl" /> : <AudioOutlined className="text-xl" />}
        </button>

        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all bg-gray-50 text-sm"
            style={{ maxHeight: '100px', minHeight: '44px' }}
            disabled={sending}
          />

          <div className="flex justify-between items-center mt-1.5 px-1">
            <span className={`text-xs ${message.length > maxLength * 0.9 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              {message.length} / {maxLength}
            </span>
            {sendingCount > 0 && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse"></span>
                发送中...
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={(!message.trim() && selectedImages.length === 0 && !selectedVideo && !audioBlob) || message.length > maxLength || sending || isRecording}
          className="px-4 py-2.5 bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] text-white font-medium rounded-xl hover:from-[#43A047] hover:to-[#5CB860] disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md disabled:shadow-none text-sm flex-shrink-0"
        >
          {sending ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            </span>
          ) : (
            '发送'
          )}
        </button>
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
