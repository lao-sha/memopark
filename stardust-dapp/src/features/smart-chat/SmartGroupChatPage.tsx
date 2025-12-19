/// Stardust智能群聊页面 - 乐观UI更新演示
///
/// 展示50ms瞬时响应的完整聊天体验

import React, { useState, useEffect, useRef } from 'react';
import { Card, Tabs, Select, Button, Badge, Tooltip, Switch, message as antMessage, Modal, Image } from 'antd';
import {
  MessageOutlined,
  SettingOutlined,
  SecurityScanOutlined,
  RobotOutlined,
  DashboardOutlined,
  GroupOutlined,
  BulbOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import OptimisticUIManager from '../../lib/optimistic-ui-manager';
import {
  OptimisticMessageList,
  OptimisticSendMessage,
  OptimisticMessageComponent,
} from '../../components/optimistic/OptimisticMessageComponents';
import smartChatService from '../../services/smartChatService';

// ========== IPFS 网关和媒体渲染 ==========

// 本地 IPFS 网关（优先使用本地，快速且无需等待传播）
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
            {/* 视频缩略图容器 */}
            <div className="w-[180px] h-[120px] rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 relative overflow-hidden">
              {/* 加载占位符 */}
              <div className="absolute inset-0 flex items-center justify-center video-thumb-loading">
                <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <video
                src={videoUrl}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
                onLoadedMetadata={(e) => {
                  // 缩略图加载完成后隐藏加载指示器
                  const loader = e.currentTarget.parentElement?.querySelector('.video-thumb-loading') as HTMLElement;
                  if (loader) loader.style.display = 'none';
                }}
              />
            </div>
            {/* 播放按钮覆盖层 */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg group-hover:bg-black/40 transition-colors">
              <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
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

// ========== 类型定义 ==========

interface SmartGroupChatProps {
  groupId?: string;
  currentUser: string;
  initialMessages?: any[];
  onBack?: () => void;
}

interface GroupSettings {
  encryptionMode: 'military' | 'business' | 'selective' | 'transparent';
  aiAssistEnabled: boolean;
  autoRetryEnabled: boolean;
  showProgressDetails: boolean;
  maxRetries: number;
}

interface PerformanceStats {
  avgUIResponseTime: number;
  avgConfirmationTime: number;
  successRate: number;
  totalMessagesSent: number;
  errorCount: number;
}

// ========== 主要组件 ==========

export const SmartGroupChatPage: React.FC<SmartGroupChatProps> = ({
  groupId = 'demo_group_001',
  currentUser,
  initialMessages = [],
  onBack,
}) => {
  // 状态管理
  const [optimisticManager] = useState(() => new OptimisticUIManager());
  const [activeTab, setActiveTab] = useState('performance');
  const [historicalMessages, setHistoricalMessages] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [groupSettings, setGroupSettings] = useState<GroupSettings>({
    encryptionMode: 'business',
    aiAssistEnabled: true,
    autoRetryEnabled: true,
    showProgressDetails: true,
    maxRetries: 3,
  });
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    avgUIResponseTime: 0,
    avgConfirmationTime: 0,
    successRate: 0,
    totalMessagesSent: 0,
    errorCount: 0,
  });
  const [isConnected, setIsConnected] = useState(true);
  const [messageCount, setMessageCount] = useState(0);

  // 引用
  const performanceUpdateRef = useRef<NodeJS.Timeout>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 进入聊天页面时隐藏底部导航栏，离开时恢复
  useEffect(() => {
    // 隐藏导航栏
    window.dispatchEvent(new CustomEvent('mp.nav.visibility', { detail: { hidden: true } }));

    // 组件卸载时恢复导航栏
    return () => {
      window.dispatchEvent(new CustomEvent('mp.nav.visibility', { detail: { hidden: false } }));
    };
  }, []);

  // 加载群组历史消息
  useEffect(() => {
    const loadHistoryMessages = async () => {
      if (!groupId || groupId === 'demo_group_001') {
        console.log('跳过加载历史消息: groupId =', groupId);
        return;
      }

      try {
        setLoadingHistory(true);
        console.log('开始加载群组历史消息, groupId:', groupId);

        const messages = await smartChatService.getGroupMessages(groupId, 100, 0);
        console.log('成功加载历史消息:', messages.length, '条');

        // 将历史消息保存到状态
        setHistoricalMessages(messages);

        // 滚动到最新消息
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        if (messages.length === 0) {
          console.log('该群组暂无历史消息');
        }
      } catch (error) {
        console.error('加载历史消息失败:', error);
        antMessage.error('加载历史消息失败: ' + (error instanceof Error ? error.message : '未知错误'));
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistoryMessages();
  }, [groupId]);

  // 初始化乐观UI管理器
  useEffect(() => {
    // 监听性能更新
    const updatePerformance = () => {
      const metrics = optimisticManager.getPerformanceMetrics();
      setPerformanceStats({
        avgUIResponseTime: metrics.uiResponseTimes.length > 0
          ? metrics.uiResponseTimes.reduce((a, b) => a + b, 0) / metrics.uiResponseTimes.length
          : 0,
        avgConfirmationTime: metrics.averageConfirmationTime,
        successRate: metrics.successRate * 100,
        totalMessagesSent: metrics.confirmationTimes.length,
        errorCount: Array.from(metrics.errorCounts.values()).reduce((a, b) => a + b, 0),
      });
    };

    // 监听消息事件
    const handleMessageAdded = () => {
      setMessageCount(prev => prev + 1);
      updatePerformance();
    };

    const handleMessageConfirmed = () => {
      updatePerformance();
      antMessage.success('消息发送成功！');
    };

    const handleMessageFailed = (message: any) => {
      updatePerformance();
      antMessage.error(`消息发送失败: ${message.errorInfo || '未知错误'}`);
    };

    optimisticManager.on('messageAdded', handleMessageAdded);
    optimisticManager.on('messageConfirmed', handleMessageConfirmed);
    optimisticManager.on('messageFailed', handleMessageFailed);

    // 定期更新性能数据
    performanceUpdateRef.current = setInterval(updatePerformance, 1000);

    return () => {
      optimisticManager.off('messageAdded', handleMessageAdded);
      optimisticManager.off('messageConfirmed', handleMessageConfirmed);
      optimisticManager.off('messageFailed', handleMessageFailed);

      if (performanceUpdateRef.current) {
        clearInterval(performanceUpdateRef.current);
      }
    };
  }, [optimisticManager]);

  // 处理消息发送
  const handleMessageSent = (tempId: string) => {
    console.log('消息已添加到队列:', tempId);
  };

  // 渲染聊天界面
  const renderChatInterface = () => (
    <div className="h-[calc(100vh-180px)] flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 聊天头部 - 纪念馆风格绿色渐变 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] text-white">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
            <GroupOutlined className="text-xl" />
          </div>
          <div>
            <h3 className="font-semibold text-base">智能群聊</h3>
            <p className="text-xs text-white/80 flex items-center gap-2">
              <span className="hidden sm:inline">ID: {groupId.slice(0, 8)}...</span>
              <span className="flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-200' : 'bg-red-300'} animate-pulse`}></span>
                {isConnected ? '在线' : '离线'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge count={messageCount} size="small" style={{ backgroundColor: '#ff6b35' }} />
          <Tooltip title="设置">
            <button
              onClick={() => setSettingsModalVisible(true)}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <SettingOutlined className="text-lg" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 消息列表 - 白色背景 */}
      <div
        className="flex-1 bg-[#f5f5f5] overflow-y-auto p-3"
        onClick={(e) => {
          // 处理视频预览点击
          const target = e.target as HTMLElement;
          const videoTrigger = target.closest('.video-preview-trigger') as HTMLElement;
          if (videoTrigger) {
            const videoUrl = videoTrigger.dataset.videoUrl;
            if (videoUrl) {
              setVideoPreviewUrl(videoUrl);
            }
          }
        }}
      >
        {/* 加载提示 */}
        {loadingHistory && (
          <div className="text-center text-gray-500 py-4">
            <span className="inline-block animate-spin mr-2">⏳</span>
            加载历史消息...
          </div>
        )}

        {/* 暂无消息提示 */}
        {!loadingHistory && historicalMessages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <div className="text-3xl mb-2">💬</div>
            <div className="text-sm">暂无历史消息</div>
            <div className="text-xs mt-1">发送第一条消息开始聊天吧！</div>
          </div>
        )}

        {/* 历史消息 */}
        {historicalMessages.map((msg) => (
          <div key={msg.id} className="mb-2 p-2.5 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4CAF50] to-[#66BB6A] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {msg.sender.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-700 truncate">
                    {msg.sender.slice(0, 8)}...{msg.sender.slice(-6)}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {new Date(msg.timestamp * 1000).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="text-sm text-gray-800 break-words">{renderMessageContent(msg.content)}</div>
              </div>
            </div>
          </div>
        ))}

        {/* 乐观UI消息列表 */}
        <OptimisticMessageList
          groupId={groupId}
          currentUser={currentUser}
          optimisticManager={optimisticManager}
        />

        {/* 滚动锚点 - 用于自动滚动到最新消息 */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );

  // 渲染设置面板
  const renderSettingsPanel = () => (
    <div className="space-y-3">
      {/* 基础设置 */}
      <Card title={<span className="text-sm font-semibold text-gray-700">基础设置</span>} size="small" className="shadow-sm border-gray-100" style={{ borderRadius: '0.75rem' }}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">AI智能助手</span>
            <Switch
              checked={groupSettings.aiAssistEnabled}
              onChange={(checked) => setGroupSettings(prev => ({ ...prev, aiAssistEnabled: checked }))}
              size="small"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">自动重试</span>
            <Switch
              checked={groupSettings.autoRetryEnabled}
              onChange={(checked) => setGroupSettings(prev => ({ ...prev, autoRetryEnabled: checked }))}
              size="small"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">显示进度详情</span>
            <Switch
              checked={groupSettings.showProgressDetails}
              onChange={(checked) => setGroupSettings(prev => ({ ...prev, showProgressDetails: checked }))}
              size="small"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">最大重试次数</span>
            <Select
              value={groupSettings.maxRetries}
              onChange={(value) => setGroupSettings(prev => ({ ...prev, maxRetries: value }))}
              className="w-16"
              size="small"
            >
              {[1, 2, 3, 5, 10].map(num => (
                <Select.Option key={num} value={num}>{num}</Select.Option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* 加密设置 */}
      <Card title={<span className="text-sm font-semibold text-gray-700">安全设置</span>} size="small" className="shadow-sm border-gray-100" style={{ borderRadius: '0.75rem' }}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-gray-700">默认加密模式</label>
            <Select
              value={groupSettings.encryptionMode}
              onChange={(value) => setGroupSettings(prev => ({ ...prev, encryptionMode: value }))}
              className="w-full"
              size="small"
            >
              <Select.Option value="military">
                <span className="text-xs">🔒 军用级 - 量子抗性</span>
              </Select.Option>
              <Select.Option value="business">
                <span className="text-xs">🏢 商用级 - 平衡性能</span>
              </Select.Option>
              <Select.Option value="selective">
                <span className="text-xs">🎯 选择性 - 灵活配置</span>
              </Select.Option>
              <Select.Option value="transparent">
                <span className="text-xs">🌐 透明 - 最高性能</span>
              </Select.Option>
            </Select>
          </div>

          <div className="p-2.5 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-1 text-xs">当前模式说明：</h4>
            <p className="text-xs text-blue-700">
              {getEncryptionModeDescription(groupSettings.encryptionMode)}
            </p>
          </div>
        </div>
      </Card>

      {/* 演示控制 */}
      <Card title={<span className="text-sm font-semibold text-gray-700">演示控制</span>} size="small" className="shadow-sm border-gray-100" style={{ borderRadius: '0.75rem' }}>
        <div className="space-y-2">
          <Button
            type="primary"
            icon={<MessageOutlined />}
            onClick={() => simulateMessage('这是一条模拟消息')}
            block
            size="small"
            style={{ backgroundColor: '#4CAF50', borderColor: '#4CAF50' }}
          >
            发送测试消息
          </Button>

          <Button
            icon={<SecurityScanOutlined />}
            onClick={() => simulateMessage('这是包含敏感信息的消息')}
            block
            size="small"
          >
            发送敏感消息
          </Button>

          <Button
            icon={<BulbOutlined />}
            onClick={simulateNetworkIssue}
            block
            size="small"
          >
            模拟网络问题
          </Button>

          <Button
            danger
            onClick={() => optimisticManager.clearMessageQueue()}
            block
            size="small"
          >
            清空消息队列
          </Button>
        </div>
      </Card>
    </div>
  );

  // 渲染性能监控
  const renderPerformanceMonitor = () => (
    <div className="space-y-3">
      {/* 实时性能指标 - 移动端优化卡片 */}
      <Card
        title={<span className="text-gray-700 font-semibold text-sm">实时性能指标</span>}
        size="small"
        className="shadow-sm border-gray-100"
        style={{ borderRadius: '0.75rem' }}
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200/50">
            <div className="text-2xl font-black text-emerald-600 mb-0.5">
              {performanceStats.avgUIResponseTime.toFixed(1)}ms
            </div>
            <div className="text-xs font-medium text-gray-700">UI响应</div>
            <div className="text-xs text-emerald-600 mt-0.5 font-semibold">&lt;50ms ⚡</div>
          </div>

          <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200/50">
            <div className="text-2xl font-black text-blue-600 mb-0.5">
              {(performanceStats.avgConfirmationTime / 1000).toFixed(1)}s
            </div>
            <div className="text-xs font-medium text-gray-700">确认时间</div>
            <div className="text-xs text-blue-600 mt-0.5 font-semibold">2-5s 📡</div>
          </div>

          <div className="p-3 bg-gradient-to-br from-violet-50 to-violet-100 rounded-lg border border-violet-200/50">
            <div className="text-2xl font-black text-violet-600 mb-0.5">
              {performanceStats.successRate.toFixed(1)}%
            </div>
            <div className="text-xs font-medium text-gray-700">成功率</div>
            <div className="text-xs text-violet-600 mt-0.5 font-semibold">&gt;95% ✓</div>
          </div>

          <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200/50">
            <div className="text-2xl font-black text-amber-600 mb-0.5">
              {performanceStats.totalMessagesSent}
            </div>
            <div className="text-xs font-medium text-gray-700">已发送</div>
            <div className="text-xs text-amber-600 mt-0.5 font-semibold">错误: {performanceStats.errorCount}</div>
          </div>
        </div>
      </Card>

      {/* AI分析报告 - 优化样式 */}
      <Card
        title={<span className="text-gray-700 font-semibold text-sm">💡 AI智能建议</span>}
        size="small"
        className="shadow-sm border-gray-100"
        style={{ borderRadius: '0.75rem' }}
      >
        <div className="space-y-2">
          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-400 rounded-lg">
            <div className="flex items-start gap-2">
              <RobotOutlined className="text-amber-600 text-lg mt-0.5" />
              <div>
                <span className="font-semibold text-amber-900 block mb-0.5 text-xs">安全提示</span>
                <p className="text-xs text-amber-800 leading-relaxed">
                  建议升级至商用级或军用级加密以确保数据安全。
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-400 rounded-lg">
            <div className="flex items-start gap-2">
              <BulbOutlined className="text-emerald-600 text-lg mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-900 block mb-0.5 text-xs">性能优化</span>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  网络状况良好，可启用更高级安全设置。
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  // 获取加密模式描述
  const getEncryptionModeDescription = (mode: string) => {
    switch (mode) {
      case 'military':
        return '采用量子抗性算法和多层加密，提供最高级别的安全保护，适合处理机密信息。';
      case 'business':
        return '标准端到端加密，平衡安全性与性能，适合商业环境的日常沟通。';
      case 'selective':
        return '用户可以根据消息内容自主选择加密级别，AI会提供智能建议。';
      case 'transparent':
        return '消息公开存储在区块链上，提供最高的透明度和访问性能。';
      default:
        return '未知模式';
    }
  };

  // 模拟发送消息
  const simulateMessage = async (content: string) => {
    try {
      await optimisticManager.sendMessageOptimistic(
        null, // receiver
        groupId, // groupId
        content,
        {
          priority: 'normal',
          encryptionMode: groupSettings.encryptionMode,
          enableRetry: groupSettings.autoRetryEnabled,
          maxRetries: groupSettings.maxRetries,
        }
      );
    } catch (error) {
      console.error('模拟消息发送失败:', error);
    }
  };

  // 模拟网络问题
  const simulateNetworkIssue = () => {
    setIsConnected(false);
    antMessage.warning('模拟网络中断，消息将进入重试队列');

    setTimeout(() => {
      setIsConnected(true);
      antMessage.success('网络恢复，开始重试待发送消息');
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col max-w-[414px] mx-auto">
      <div className="flex-1 p-3 pb-0">
        {/* 页面标题 - 纪念馆风格 */}
        <div className="mb-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 hover:bg-white/80 rounded-lg transition-colors"
              >
                <ArrowLeftOutlined className="text-lg text-gray-600" />
              </button>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800 mb-0.5">
                智能群聊
              </h1>
              <p className="text-gray-600 text-xs flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1">
                  ⚡ 50ms响应
                </span>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1">
                  🔒 {groupSettings.encryptionMode === 'military' ? '军用级' : groupSettings.encryptionMode === 'business' ? '商用级' : groupSettings.encryptionMode === 'selective' ? '选择性' : '透明'}
                </span>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1">
                  🛡️ 量子安全
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* 聊天界面 */}
        <div>
          {renderChatInterface()}
        </div>
      </div>

      {/* 底部输入框 - 固定在导航栏上方 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-lg">
        <OptimisticSendMessage
          groupId={groupId}
          optimisticManager={optimisticManager}
          onMessageSent={handleMessageSent}
          placeholder="输入消息..."
          maxLength={2000}
        />
      </div>

      {/* 视频预览弹窗 */}
      <Modal
        open={!!videoPreviewUrl}
        onCancel={() => setVideoPreviewUrl(null)}
        footer={null}
        width="90vw"
        centered
        closable
        maskClosable
        destroyOnHidden
        styles={{
          content: { padding: 0, background: 'transparent', boxShadow: 'none' },
          body: { padding: 0 }
        }}
        style={{ maxWidth: '600px' }}
      >
        {videoPreviewUrl && (
          <div className="flex justify-center items-center bg-black rounded-lg overflow-hidden relative">
            {/* 加载指示器 */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 video-loading-overlay">
              <div className="text-center text-white">
                <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <div className="text-sm">加载视频中...</div>
              </div>
            </div>
            <video
              src={videoPreviewUrl}
              controls
              autoPlay
              className="w-full"
              style={{ maxHeight: '70vh' }}
              playsInline
              onCanPlay={(e) => {
                // 视频可以播放时隐藏加载指示器
                const overlay = e.currentTarget.parentElement?.querySelector('.video-loading-overlay') as HTMLElement;
                if (overlay) overlay.style.display = 'none';
              }}
              onWaiting={(e) => {
                // 视频缓冲时显示加载指示器
                const overlay = e.currentTarget.parentElement?.querySelector('.video-loading-overlay') as HTMLElement;
                if (overlay) overlay.style.display = 'flex';
              }}
            />
          </div>
        )}
      </Modal>

      {/* 设置弹窗 */}
      <Modal
        title={<span className="font-semibold text-gray-800">群聊设置</span>}
        open={settingsModalVisible}
        onCancel={() => setSettingsModalVisible(false)}
        footer={null}
        width={400}
        centered
        styles={{
          body: { padding: '12px', maxHeight: '70vh', overflowY: 'auto' }
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          className="smart-chat-tabs"
          items={[
            {
              key: 'performance',
              label: (
                <span className="flex items-center gap-1.5 text-xs">
                  <DashboardOutlined />
                  <span>性能监控</span>
                </span>
              ),
              children: renderPerformanceMonitor(),
            },
            {
              key: 'settings',
              label: (
                <span className="flex items-center gap-1.5 text-xs">
                  <SettingOutlined />
                  <span>聊天设置</span>
                </span>
              ),
              children: renderSettingsPanel(),
            },
          ]}
        />
      </Modal>

      <style>{`
        .smart-chat-tabs .ant-tabs-nav {
          margin-bottom: 0.75rem;
        }
        .smart-chat-tabs .ant-tabs-tab {
          padding: 0.375rem 0.75rem;
          border-radius: 0.5rem;
          transition: all 0.3s;
        }
        .smart-chat-tabs .ant-tabs-tab:hover {
          background: rgba(76, 175, 80, 0.1);
        }
        .smart-chat-tabs .ant-tabs-tab-active {
          background: rgba(76, 175, 80, 0.15);
        }
      `}</style>
    </div>
  );
};

export default SmartGroupChatPage;
