/// Stardust智能群聊应用 - 完整集成组件
///
/// 集成前端乐观UI和后端区块链交互的完整应用

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Modal, message as antMessage, Button, List, Avatar, Badge } from 'antd';
import {
  PlusOutlined,
  SettingOutlined,
  UsergroupDeleteOutlined,
  LoginOutlined,
  LogoutOutlined,
} from '@ant-design/icons';

// 导入核心组件
import { SmartGroupChatPage } from './SmartGroupChatPage';
import OptimisticUIManager from '../../lib/optimistic-ui-manager';
import smartChatService, { GroupInfo, GroupMessage, GroupMember } from '../../services/smartChatService';

// 导入钱包相关
import { useWallet } from '../../hooks/useWallet';
import { usePolkadotApi } from '../../hooks/usePolkadotApi';

// ========== 接口定义 ==========

interface SmartChatAppProps {
  onBack?: () => void;
}

// ========== 主要应用组件 ==========

export const SmartChatApp: React.FC<SmartChatAppProps> = ({ onBack }) => {
  // 状态管理
  const [currentView, setCurrentView] = useState<'group-list' | 'chat' | 'create-group'>('group-list');
  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null);
  const [userGroups, setUserGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [optimisticManager] = useState(() => new OptimisticUIManager());

  // 钱包和API hooks
  const { account, keyring } = useWallet();
  const { api, isReady } = usePolkadotApi();

  // 引用
  const eventUnsubscribeRef = useRef<(() => void) | null>(null);

  // 获取当前用户地址
  const currentUser = account?.address || '';

  // 初始化用户群组列表
  const loadUserGroups = useCallback(async () => {
    if (!currentUser || !isReady) return;

    setLoading(true);
    try {
      const groups = await smartChatService.getUserGroups(currentUser);
      setUserGroups(groups);
    } catch (error) {
      console.error('加载群组列表失败:', error);
      antMessage.error('加载群组列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentUser, isReady]);

  // 初始化加载
  useEffect(() => {
    loadUserGroups();
  }, [loadUserGroups]);

  // 清理事件订阅
  useEffect(() => {
    return () => {
      if (eventUnsubscribeRef.current) {
        eventUnsubscribeRef.current();
      }
    };
  }, []);

  // 创建群组
  const handleCreateGroup = useCallback(async (
    name: string,
    description?: string,
    encryptionMode: 'Military' | 'Business' | 'Selective' | 'Transparent' = 'Business',
    isPublic: boolean = false
  ) => {
    if (!account || !keyring) {
      antMessage.error('请先连接钱包');
      return;
    }

    try {
      setLoading(true);
      const groupId = await smartChatService.createGroup(
        keyring,
        name,
        description,
        encryptionMode,
        undefined,
        isPublic
      );

      antMessage.success(`群组创建成功！群组ID: ${groupId}`);

      // 刷新群组列表
      await loadUserGroups();

      // 切换到群组列表视图
      setCurrentView('group-list');

      return groupId;
    } catch (error) {
      console.error('创建群组失败:', error);
      antMessage.error('创建群组失败，请重试');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [account, keyring, loadUserGroups]);

  // 加入群组
  const handleJoinGroup = useCallback(async (groupId: string, inviteCode?: string) => {
    if (!account || !keyring) {
      antMessage.error('请先连接钱包');
      return;
    }

    try {
      setLoading(true);
      await smartChatService.joinGroup(keyring, groupId, inviteCode);
      antMessage.success('成功加入群组！');

      // 刷新群组列表
      await loadUserGroups();
    } catch (error) {
      console.error('加入群组失败:', error);
      antMessage.error('加入群组失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [account, keyring, loadUserGroups]);

  // 离开群组
  const handleLeaveGroup = useCallback(async (groupId: string) => {
    if (!account || !keyring) {
      antMessage.error('请先连接钱包');
      return;
    }

    Modal.confirm({
      title: '确认离开群组',
      content: '您确定要离开这个群组吗？离开后无法查看历史消息。',
      onOk: async () => {
        try {
          setLoading(true);
          await smartChatService.leaveGroup(keyring, groupId);
          antMessage.success('成功离开群组');

          // 如果当前正在查看该群组，返回群组列表
          if (selectedGroup?.id === groupId) {
            setSelectedGroup(null);
            setCurrentView('group-list');
          }

          // 刷新群组列表
          await loadUserGroups();
        } catch (error) {
          console.error('离开群组失败:', error);
          antMessage.error('离开群组失败，请重试');
        } finally {
          setLoading(false);
        }
      },
    });
  }, [account, keyring, selectedGroup, loadUserGroups]);

  // 进入群组聊天
  const handleEnterGroup = useCallback(async (group: GroupInfo) => {
    setSelectedGroup(group);
    setCurrentView('chat');

    // 订阅群组事件
    if (eventUnsubscribeRef.current) {
      eventUnsubscribeRef.current();
    }

    eventUnsubscribeRef.current = smartChatService.subscribeToGroupEvents(
      group.id,
      (message: GroupMessage) => {
        console.log('收到新消息:', message);
        // 这里可以触发UI更新或通知
      },
      (member: GroupMember) => {
        console.log('新成员加入:', member);
        antMessage.info(`${member.accountId.slice(0, 8)}... 加入了群组`);
      },
      (accountId: string) => {
        console.log('成员离开:', accountId);
        antMessage.info(`${accountId.slice(0, 8)}... 离开了群组`);
      },
      (encryptionMode: string) => {
        console.log('加密模式更新:', encryptionMode);
        antMessage.info(`群组加密模式已更新为: ${encryptionMode}`);
      }
    );
  }, []);

  // 返回群组列表
  const handleBackToGroupList = useCallback(() => {
    setSelectedGroup(null);
    setCurrentView('group-list');

    // 取消事件订阅
    if (eventUnsubscribeRef.current) {
      eventUnsubscribeRef.current();
      eventUnsubscribeRef.current = null;
    }
  }, []);

  // 渲染群组列表
  const renderGroupList = () => (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <h1 className="text-xl font-bold text-gray-800">智能群聊</h1>
        <div className="flex space-x-2">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCurrentView('create-group')}
            size="small"
          >
            创建群组
          </Button>
          {onBack && (
            <Button onClick={onBack} size="small">
              返回
            </Button>
          )}
        </div>
      </div>

      {/* 用户信息 */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex items-center space-x-3">
          <Avatar className="bg-blue-500">
            {currentUser ? currentUser.slice(0, 2).toUpperCase() : 'U'}
          </Avatar>
          <div>
            <div className="font-medium text-gray-800">
              {currentUser ? `${currentUser.slice(0, 8)}...` : '未连接钱包'}
            </div>
            <div className="text-sm text-gray-500">
              参与群组: {userGroups.length}
            </div>
          </div>
        </div>
      </div>

      {/* 群组列表 */}
      <div className="flex-1 overflow-y-auto">
        {userGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <UsergroupDeleteOutlined className="text-4xl mb-4" />
            <p>暂无群组</p>
            <Button
              type="link"
              onClick={() => setCurrentView('create-group')}
              className="mt-2"
            >
              创建你的第一个群组
            </Button>
          </div>
        ) : (
          <List
            loading={loading}
            dataSource={userGroups}
            renderItem={(group) => (
              <List.Item
                className="cursor-pointer hover:bg-gray-50 px-4"
                onClick={() => handleEnterGroup(group)}
                actions={[
                  <Button
                    key="leave"
                    type="text"
                    icon={<LogoutOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLeaveGroup(group.id);
                    }}
                    className="text-red-500 hover:text-red-600"
                  >
                    离开
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar className="bg-green-500">
                      {group.name.charAt(0).toUpperCase()}
                    </Avatar>
                  }
                  title={
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{group.name}</span>
                      <Badge
                        count={group.encryptionMode}
                        style={{
                          backgroundColor: getEncryptionModeColor(group.encryptionMode),
                          fontSize: '10px',
                          height: '16px',
                          lineHeight: '16px',
                        }}
                      />
                    </div>
                  }
                  description={
                    <div>
                      <div className="text-sm text-gray-600 mb-1">
                        {group.description || '暂无描述'}
                      </div>
                      <div className="text-xs text-gray-500">
                        成员: {group.memberCount} |
                        {group.isPublic ? ' 公开群组' : ' 私密群组'}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );

  // 渲染创建群组表单
  const renderCreateGroupForm = () => {
    const [formData, setFormData] = useState({
      name: '',
      description: '',
      encryptionMode: 'Business' as 'Military' | 'Business' | 'Selective' | 'Transparent',
      isPublic: false,
    });

    const handleSubmit = async () => {
      if (!formData.name.trim()) {
        antMessage.error('请输入群组名称');
        return;
      }

      try {
        await handleCreateGroup(
          formData.name.trim(),
          formData.description.trim() || undefined,
          formData.encryptionMode,
          formData.isPublic
        );
      } catch (error) {
        // 错误已在handleCreateGroup中处理
      }
    };

    return (
      <div className="h-full flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <h1 className="text-xl font-bold text-gray-800">创建群组</h1>
          <Button onClick={() => setCurrentView('group-list')} size="small">
            返回
          </Button>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 p-4 overflow-y-auto">
          <Card>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">群组名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="输入群组名称"
                  maxLength={64}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">群组描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="描述群组用途（可选）"
                  rows={3}
                  maxLength={512}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">加密模式</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { mode: 'Military' as const, label: '🔒 军用级', desc: '最高安全，量子抗性' },
                    { mode: 'Business' as const, label: '🏢 商用级', desc: '平衡安全与性能' },
                    { mode: 'Selective' as const, label: '🎯 选择性', desc: '用户自主选择' },
                    { mode: 'Transparent' as const, label: '🌐 透明', desc: '公开存储，高性能' },
                  ].map(({ mode, label, desc }) => (
                    <div
                      key={mode}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.encryptionMode === mode
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => setFormData({ ...formData, encryptionMode: mode })}
                    >
                      <div className="font-medium text-sm">{label}</div>
                      <div className="text-xs text-gray-500 mt-1">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="rounded"
                />
                <label className="text-sm">公开群组（所有人可见和加入）</label>
              </div>

              <Button
                type="primary"
                size="large"
                block
                loading={loading}
                onClick={handleSubmit}
                disabled={!formData.name.trim()}
              >
                创建群组
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // 渲染聊天界面
  const renderChat = () => {
    if (!selectedGroup) return null;

    return (
      <SmartGroupChatPage
        groupId={selectedGroup.id}
        currentUser={currentUser}
        onBack={handleBackToGroupList}
      />
    );
  };

  // 获取加密模式颜色
  const getEncryptionModeColor = (mode: string): string => {
    switch (mode) {
      case 'Military': return '#ff4d4f';
      case 'Business': return '#1890ff';
      case 'Selective': return '#faad14';
      case 'Transparent': return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  // 主渲染逻辑
  switch (currentView) {
    case 'group-list':
      return renderGroupList();
    case 'create-group':
      return renderCreateGroupForm();
    case 'chat':
      return renderChat();
    default:
      return renderGroupList();
  }
};

export default SmartChatApp;