/// Stardust智能群聊页面 - 乐观UI更新演示
///
/// 展示50ms瞬时响应的完整聊天体验

import React, { useState, useEffect, useRef } from 'react';
import { Card, Tabs, Select, Button, Badge, Tooltip, Switch, message as antMessage } from 'antd';
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
  const [activeTab, setActiveTab] = useState('chat');
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
    <div className="h-96 flex flex-col bg-white rounded-lg shadow-sm border">
      {/* 聊天头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-3">
          <GroupOutlined className="text-blue-500" />
          <div>
            <h3 className="font-semibold text-gray-800">智能群聊演示</h3>
            <p className="text-sm text-gray-500">
              群组ID: {groupId} |
              <span className={`ml-1 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? '已连接' : '连接中断'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Badge count={messageCount} size="small" />
          <Tooltip title="加密模式">
            <Select
              value={groupSettings.encryptionMode}
              onChange={(value) => setGroupSettings(prev => ({ ...prev, encryptionMode: value }))}
              size="small"
              className="w-24"
            >
              <Select.Option value="military">🔒 军用级</Select.Option>
              <Select.Option value="business">🏢 商用级</Select.Option>
              <Select.Option value="selective">🎯 选择性</Select.Option>
              <Select.Option value="transparent">🌐 透明</Select.Option>
            </Select>
          </Tooltip>
        </div>
      </div>

      {/* 消息列表 */}
      <OptimisticMessageList
        groupId={groupId}
        currentUser={currentUser}
        optimisticManager={optimisticManager}
      />

      {/* 发送消息 */}
      <OptimisticSendMessage
        groupId={groupId}
        optimisticManager={optimisticManager}
        onMessageSent={handleMessageSent}
        placeholder="输入消息... (支持50ms瞬时响应)"
        maxLength={2000}
      />
    </div>
  );

  // 渲染设置面板
  const renderSettingsPanel = () => (
    <div className="space-y-6">
      {/* 基础设置 */}
      <Card title="基础设置" size="small">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>AI智能助手</span>
            <Switch
              checked={groupSettings.aiAssistEnabled}
              onChange={(checked) => setGroupSettings(prev => ({ ...prev, aiAssistEnabled: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span>自动重试</span>
            <Switch
              checked={groupSettings.autoRetryEnabled}
              onChange={(checked) => setGroupSettings(prev => ({ ...prev, autoRetryEnabled: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span>显示进度详情</span>
            <Switch
              checked={groupSettings.showProgressDetails}
              onChange={(checked) => setGroupSettings(prev => ({ ...prev, showProgressDetails: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span>最大重试次数</span>
            <Select
              value={groupSettings.maxRetries}
              onChange={(value) => setGroupSettings(prev => ({ ...prev, maxRetries: value }))}
              className="w-20"
            >
              {[1, 2, 3, 5, 10].map(num => (
                <Select.Option key={num} value={num}>{num}</Select.Option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* 加密设置 */}
      <Card title="安全设置" size="small">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">默认加密模式</label>
            <Select
              value={groupSettings.encryptionMode}
              onChange={(value) => setGroupSettings(prev => ({ ...prev, encryptionMode: value }))}
              className="w-full"
            >
              <Select.Option value="military">
                🔒 军用级 - 量子抗性加密，最高安全
              </Select.Option>
              <Select.Option value="business">
                🏢 商用级 - 标准端到端加密，平衡性能
              </Select.Option>
              <Select.Option value="selective">
                🎯 选择性 - 用户自主选择，灵活配置
              </Select.Option>
              <Select.Option value="transparent">
                🌐 透明 - 公开存储，最高性能
              </Select.Option>
            </Select>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">当前模式说明：</h4>
            <p className="text-sm text-blue-700">
              {getEncryptionModeDescription(groupSettings.encryptionMode)}
            </p>
          </div>
        </div>
      </Card>

      {/* 演示控制 */}
      <Card title="演示控制" size="small">
        <div className="space-y-3">
          <Button
            type="primary"
            icon={<MessageOutlined />}
            onClick={() => simulateMessage('这是一条模拟消息')}
            block
          >
            发送测试消息
          </Button>

          <Button
            icon={<SecurityScanOutlined />}
            onClick={() => simulateMessage('这是包含敏感信息的消息：密码123456')}
            block
          >
            发送敏感消息
          </Button>

          <Button
            icon={<BulbOutlined />}
            onClick={simulateNetworkIssue}
            block
          >
            模拟网络问题
          </Button>

          <Button
            danger
            onClick={() => optimisticManager.clearMessageQueue()}
            block
          >
            清空消息队列
          </Button>
        </div>
      </Card>
    </div>
  );

  // 渲染性能监控
  const renderPerformanceMonitor = () => (
    <div className="space-y-6">
      {/* 实时性能指标 */}
      <Card title="实时性能指标" size="small">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {performanceStats.avgUIResponseTime.toFixed(1)}ms
            </div>
            <div className="text-sm text-gray-600">平均UI响应时间</div>
            <div className="text-xs text-green-600">目标: &lt;50ms</div>
          </div>

          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {(performanceStats.avgConfirmationTime / 1000).toFixed(1)}s
            </div>
            <div className="text-sm text-gray-600">平均确认时间</div>
            <div className="text-xs text-blue-600">预期: 2-5s</div>
          </div>

          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {performanceStats.successRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">成功率</div>
            <div className="text-xs text-purple-600">目标: &gt;95%</div>
          </div>

          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {performanceStats.totalMessagesSent}
            </div>
            <div className="text-sm text-gray-600">总发送消息数</div>
            <div className="text-xs text-orange-600">错误: {performanceStats.errorCount}</div>
          </div>
        </div>
      </Card>

      {/* 性能趋势图 */}
      <Card title="性能趋势" size="small">
        <div className="h-40 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center text-gray-500">
            <DashboardOutlined className="text-4xl mb-2" />
            <p>性能图表 (可集成Chart.js)</p>
          </div>
        </div>
      </Card>

      {/* AI分析报告 */}
      <Card title="AI分析报告" size="small">
        <div className="space-y-3">
          <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
            <div className="flex items-center space-x-2 mb-1">
              <RobotOutlined className="text-yellow-600" />
              <span className="font-medium text-yellow-800">智能建议</span>
            </div>
            <p className="text-sm text-yellow-700">
              检测到您经常发送敏感信息，建议将默认加密模式升级至商用级或军用级。
            </p>
          </div>

          <div className="p-3 bg-green-50 border-l-4 border-green-400">
            <div className="flex items-center space-x-2 mb-1">
              <BulbOutlined className="text-green-600" />
              <span className="font-medium text-green-800">性能优化</span>
            </div>
            <p className="text-sm text-green-700">
              您的网络状况良好，可以启用更高级的安全设置而不影响性能。
            </p>
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
    <div className="max-w-6xl mx-auto p-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {onBack && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              className="text-gray-600 hover:text-gray-800"
            >
              返回
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Stardust 智能群聊系统演示
            </h1>
            <p className="text-gray-600">
              体验50ms瞬时响应的乐观UI更新 | 四种加密模式 | AI智能决策 | 量子抗性安全
            </p>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：聊天界面 */}
        <div className="lg:col-span-2">
          <Card title="智能群聊界面" className="h-full">
            {renderChatInterface()}
          </Card>
        </div>

        {/* 右侧：控制面板 */}
        <div>
          <Card className="h-full">
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              items={[
                {
                  key: 'chat',
                  label: '聊天设置',
                  children: renderSettingsPanel(),
                  icon: <SettingOutlined />,
                },
                {
                  key: 'performance',
                  label: '性能监控',
                  children: renderPerformanceMonitor(),
                  icon: <DashboardOutlined />,
                },
              ]}
            />
          </Card>
        </div>
      </div>

      {/* 底部：功能说明 */}
      <Card title="功能特性说明" className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4">
            <MessageOutlined className="text-3xl text-blue-500 mb-2" />
            <h3 className="font-semibold mb-1">乐观UI更新</h3>
            <p className="text-sm text-gray-600">50ms瞬时响应，后台异步处理</p>
          </div>

          <div className="text-center p-4">
            <SecurityScanOutlined className="text-3xl text-green-500 mb-2" />
            <h3 className="font-semibold mb-1">智能安全</h3>
            <p className="text-sm text-gray-600">四种加密模式，场景自适应</p>
          </div>

          <div className="text-center p-4">
            <RobotOutlined className="text-3xl text-purple-500 mb-2" />
            <h3 className="font-semibold mb-1">AI决策引擎</h3>
            <p className="text-sm text-gray-600">智能分析内容，推荐最佳策略</p>
          </div>

          <div className="text-center p-4">
            <DashboardOutlined className="text-3xl text-orange-500 mb-2" />
            <h3 className="font-semibold mb-1">性能监控</h3>
            <p className="text-sm text-gray-600">实时监控，智能优化建议</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SmartGroupChatPage;