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
  GroupOutlined,
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

  // 创建群组表单状态
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    encryptionMode: 'Business' as 'Military' | 'Business' | 'Selective' | 'Transparent',
    isPublic: false,
  });

  // 钱包和API hooks
  const { account } = useWallet();
  const { api, isReady } = usePolkadotApi();

  // 引用
  const eventUnsubscribeRef = useRef<(() => void) | null>(null);

  // 获取当前用户地址
  const currentUser = account?.address || '';

  // 初始化用户群组列表
  const loadUserGroups = useCallback(async () => {
    console.log('=== loadUserGroups 执行 ===');
    console.log('当前用户:', currentUser);
    console.log('API就绪状态:', isReady);

    if (!currentUser || !isReady) {
      console.log('用户或API未就绪，跳过加载');
      return;
    }

    setLoading(true);
    try {
      console.log('调用 smartChatService.getUserGroups...');
      const groups = await smartChatService.getUserGroups(currentUser);
      console.log('获取到的群组列表:', groups);
      console.log('群组数量:', groups.length);
      console.log('群组详情:', groups.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount })));

      setUserGroups(groups);
      console.log('群组列表已更新到状态中');
    } catch (error) {
      console.error('加载群组列表失败:', error);
      antMessage.error('加载群组列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentUser, isReady]);

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

  // 通过群组ID进入群组（异步版本）
  const handleEnterGroupByIdAsync = useCallback(async (groupId: string) => {
    console.log('=== handleEnterGroupByIdAsync 执行 ===');
    console.log('目标群组ID:', groupId);
    console.log('当前群组列表:', userGroups);
    console.log('当前用户:', currentUser);

    if (!currentUser) {
      console.error('用户未登录');
      antMessage.error('请先连接钱包');
      return;
    }

    if (!userGroups || userGroups.length === 0) {
      console.log('群组列表为空，重新加载...');
      await loadUserGroups();

      // 重新加载后再次尝试
      console.log('重新加载后的群组列表:', userGroups);
      return;
    }

    console.log('搜索群组，群组ID:', groupId);
    console.log('可用群组ID列表:', userGroups.map(g => g.id));

    // 更强健的群组ID匹配逻辑，同时支持字符串和数字比较
    const group = userGroups.find(g => {
      const groupIdStr = String(g.id);
      const targetIdStr = String(groupId);
      const match = groupIdStr === targetIdStr;
      console.log(`比较群组ID: "${groupIdStr}" === "${targetIdStr}" ?`, match);
      return match;
    });

    if (group) {
      console.log('成功找到目标群组:', group);
      console.log('调用 handleEnterGroup...');
      await handleEnterGroup(group);
      // 清除URL参数
      window.history.replaceState({}, '', window.location.pathname + '#/smart-chat');
      console.log('URL参数已清除');
    } else {
      console.error('=== 群组匹配失败 ===');
      console.error('搜索的群组ID:', groupId, '(类型:', typeof groupId, ')');
      console.error('可用的群组:', userGroups.map(g => ({
        id: g.id,
        idType: typeof g.id,
        idAsString: String(g.id),
        name: g.name,
        exactMatch: g.id === groupId,
        stringMatch: String(g.id) === String(groupId)
      })));

      // 尝试通过不同方式查找
      const byStringMatch = userGroups.find(g => String(g.id) === String(groupId));
      console.error('通过字符串匹配结果:', byStringMatch);

      antMessage.error(`群组 ${groupId} 不存在或您不是该群组成员`);
    }
  }, [userGroups, loadUserGroups, handleEnterGroup, currentUser]);

  // 初始化加载
  useEffect(() => {
    loadUserGroups();
  }, [loadUserGroups]);

  // 检查URL参数（在群组列表加载后）
  useEffect(() => {
    console.log('=== URL参数检查 useEffect ===');
    console.log('userGroups:', userGroups);
    console.log('userGroups 长度:', userGroups?.length || 0);

    const hash = window.location.hash;
    console.log('当前 hash:', hash);

    const urlParams = new URLSearchParams(hash.split('?')[1] || '');
    console.log('解析到的 URL 参数:', Array.from(urlParams.entries()));

    const groupId = urlParams.get('groupId');
    console.log('提取的 groupId:', groupId);

    if (groupId) {
      console.log('检测到群组ID，准备进入群组:', groupId);

      if (userGroups && userGroups.length > 0) {
        console.log('群组列表已加载，查找匹配的群组...');
        const targetGroup = userGroups.find(g => String(g.id) === String(groupId));
        console.log('找到的目标群组:', targetGroup);

        if (targetGroup) {
          console.log('找到匹配群组，调用 handleEnterGroupByIdAsync');
          handleEnterGroupByIdAsync(groupId);
        } else {
          console.warn('=== URL检查：未找到匹配的群组 ===');
          console.warn('搜索群组ID:', groupId, '(类型:', typeof groupId, ')');
          console.warn('当前群组列表:', userGroups.map(g => ({
            id: g.id,
            idType: typeof g.id,
            name: g.name,
            stringMatch: String(g.id) === String(groupId)
          })));
          antMessage.warning(`群组 ${groupId} 不存在或您不是该群组成员`);
        }
      } else {
        console.log('群组列表尚未加载或为空，等待加载...');
      }
    } else {
      console.log('未检测到 groupId 参数');
    }
  }, [userGroups, handleEnterGroupByIdAsync]);

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
    if (!account) {
      antMessage.error('请先连接钱包');
      return;
    }

    try {
      setLoading(true);

      const groupId = await smartChatService.createGroup(
        account.address,
        name,
        description,
        encryptionMode,
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
      antMessage.error(`创建群组失败: ${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [account, loadUserGroups]);

  // 加入群组
  const handleJoinGroup = useCallback(async (groupId: string) => {
    if (!account) {
      antMessage.error('请先连接钱包');
      return;
    }

    try {
      setLoading(true);
      await smartChatService.joinGroup(account.address, groupId);
      antMessage.success('成功加入群组！');

      // 刷新群组列表
      await loadUserGroups();
    } catch (error) {
      console.error('加入群组失败:', error);
      antMessage.error(`加入群组失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, [account, loadUserGroups]);

  // 离开群组
  const handleLeaveGroup = useCallback(async (groupId: string) => {
    if (!account) {
      antMessage.error('请先连接钱包');
      return;
    }

    Modal.confirm({
      title: '确认离开群组',
      content: '您确定要离开这个群组吗？离开后无法查看历史消息。',
      onOk: async () => {
        try {
          setLoading(true);
          await smartChatService.leaveGroup(account.address, groupId);
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
          antMessage.error(`离开群组失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
          setLoading(false);
        }
      },
    });
  }, [account, selectedGroup, loadUserGroups]);

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
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col max-w-[480px] mx-auto font-['-apple-system','BlinkMacSystemFont','Segoe_UI','PingFang_SC']">
      {/* 标题栏 - 纪念馆风格绿色渐变 */}
      <div className="bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] text-white shadow-md">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                <GroupOutlined className="text-xl" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">聊天</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 通讯录入口 */}
              <button
                onClick={() => {
                  window.location.hash = '#/contacts'
                }}
                className="px-3 py-1.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg transition-all text-sm font-medium"
                title="打开通讯录"
              >
                通讯录
              </button>
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-3 py-1.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg text-sm transition-all"
                >
                  返回
                </button>
              )}
            </div>
          </div>
          <p className="text-white/80 text-xs mb-2">端到端加密 • 量子抗性安全</p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentView('create-group')}
              className="flex-1 py-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 text-sm"
            >
              <PlusOutlined />
              创建群组
            </button>
            <button
              onClick={() => {
                const groupId = window.prompt('请输入要加入的群组ID:');
                if (groupId) {
                  handleJoinGroup(groupId.trim());
                }
              }}
              className="flex-1 py-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 text-sm"
            >
              <LoginOutlined />
              加入群组
            </button>
          </div>
        </div>
      </div>

      {/* 用户信息卡片 - 白色卡片风格 */}
      <div className="px-4 py-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar size={48} className="bg-gradient-to-br from-[#4CAF50] to-[#66BB6A] text-base font-semibold shadow-sm">
                {currentUser ? currentUser.slice(0, 2).toUpperCase() : 'U'}
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-sm mb-0.5 truncate">
                {currentUser ? `${currentUser.slice(0, 8)}...${currentUser.slice(-6)}` : '未连接钱包'}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-gray-600">
                  <UsergroupDeleteOutlined className="text-[#4CAF50]" />
                  <span className="font-medium text-[#4CAF50]">{userGroups.length}</span> 个群组
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  在线
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 群组列表 - 白色卡片风格 */}
      <div className="flex-1 overflow-y-auto pb-20 px-4">
        {userGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-50 rounded-2xl flex items-center justify-center mb-3">
              <UsergroupDeleteOutlined className="text-3xl text-green-400" />
            </div>
            <p className="text-base font-medium text-gray-700 mb-1">还没有群组</p>
            <p className="text-sm text-gray-500 text-center px-4">创建您的第一个智能群聊<br/>开始安全通讯</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userGroups.map((group) => (
              <div
                key={group.id}
                onClick={() => handleEnterGroup(group)}
                className="bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 p-3 cursor-pointer transition-all active:scale-[0.98]"
              >
                <div className="flex items-start gap-2.5">
                  <div className="relative flex-shrink-0">
                    <Avatar
                      size={44}
                      className="bg-gradient-to-br from-green-400 to-emerald-500 text-base font-semibold shadow-sm"
                    >
                      {group.name.charAt(0).toUpperCase()}
                    </Avatar>
                    {group.isPublic && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
                        <span className="text-[10px]">🌐</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {group.name}
                      </h3>
                      <Badge
                        count={group.encryptionMode}
                        style={{
                          backgroundColor: getEncryptionModeColor(group.encryptionMode),
                          fontSize: '9px',
                          padding: '0 5px',
                          height: '16px',
                          lineHeight: '16px',
                          borderRadius: '8px',
                          fontWeight: '500',
                        }}
                      />
                    </div>

                    <p className="text-xs text-gray-600 mb-1.5 line-clamp-1">
                      {group.description || '暂无描述'}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <UsergroupDeleteOutlined className="text-[#4CAF50]" />
                          <span className="font-medium text-gray-700">{group.memberCount}</span> 成员
                        </span>
                        <span className="flex items-center gap-1">
                          {group.isPublic ? '🌐 公开' : '🔒 私密'}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLeaveGroup(group.id);
                        }}
                        className="flex-shrink-0 px-2.5 py-0.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors text-xs"
                      >
                        <LogoutOutlined className="mr-0.5" />
                        离开
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // 渲染创建群组表单
  const renderCreateGroupForm = () => {
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
        // 重置表单
        setFormData({
          name: '',
          description: '',
          encryptionMode: 'Business',
          isPublic: false,
        });
      } catch (error) {
        // 错误已在handleCreateGroup中处理
      }
    };

    return (
      <div className="min-h-screen bg-[#f5f5f5] flex flex-col max-w-[480px] mx-auto font-['-apple-system','BlinkMacSystemFont','Segoe_UI','PingFang_SC']">
        {/* 标题栏 - 纪念馆风格绿色渐变 */}
        <div className="bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] text-white shadow-md">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                  <PlusOutlined className="text-xl" />
                </div>
                <h1 className="text-lg font-semibold">创建群组</h1>
              </div>
              <button
                onClick={() => {
                  setCurrentView('group-list');
                  // 重置表单
                  setFormData({
                    name: '',
                    description: '',
                    encryptionMode: 'Business',
                    isPublic: false,
                  });
                }}
                className="px-3 py-1.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg text-sm transition-all"
              >
                返回
              </button>
            </div>
            <p className="text-white/80 text-xs">配置您的专属加密聊天空间</p>
          </div>
        </div>

        {/* 表单内容 - 白色卡片风格 */}
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="px-4 py-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
              <div className="space-y-3">
                {/* 群组名称 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    群组名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#4CAF50] focus:ring-1 focus:ring-[#4CAF50] transition-all text-gray-900 text-sm"
                    placeholder="例如：开发团队、产品讨论"
                    maxLength={64}
                  />
                  <p className="text-xs text-gray-500 mt-1">{formData.name.length}/64 字符</p>
                </div>

                {/* 群组描述 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">群组描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#4CAF50] focus:ring-1 focus:ring-[#4CAF50] resize-none transition-all text-gray-900 text-sm"
                    placeholder="描述群组用途和规则（可选）"
                    rows={3}
                    maxLength={512}
                  />
                  <p className="text-xs text-gray-500 mt-1">{formData.description.length}/512 字符</p>
                </div>

                {/* 加密模式 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">加密模式</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { mode: 'Military' as const, label: '🔒 军用级', desc: '最高安全', color: 'from-red-50 to-red-100', border: 'border-red-300', text: 'text-red-700' },
                      { mode: 'Business' as const, label: '🏢 商用级', desc: '平衡性能', color: 'from-green-50 to-green-100', border: 'border-[#4CAF50]', text: 'text-green-700' },
                      { mode: 'Selective' as const, label: '🎯 选择性', desc: '自主选择', color: 'from-yellow-50 to-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700' },
                      { mode: 'Transparent' as const, label: '🌐 透明', desc: '高性能', color: 'from-blue-50 to-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
                    ].map(({ mode, label, desc, color, border, text }) => (
                      <div
                        key={mode}
                        className={`p-2.5 rounded-lg cursor-pointer transition-all border ${
                          formData.encryptionMode === mode
                            ? `bg-gradient-to-br ${color} ${border} shadow-sm`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setFormData({ ...formData, encryptionMode: mode })}
                      >
                        <div className={`font-semibold text-sm mb-0.5 ${formData.encryptionMode === mode ? text : 'text-gray-800'}`}>
                          {label}
                        </div>
                        <div className="text-xs text-gray-600">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 公开选项 */}
                <div className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#4CAF50] focus:ring-[#4CAF50]"
                  />
                  <label htmlFor="isPublic" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-gray-800 text-sm mb-0.5">公开群组</div>
                    <div className="text-xs text-gray-600">所有人可发现并加入</div>
                  </label>
                </div>

                {/* 提交按钮 - 橙色强调按钮 */}
                <button
                  onClick={handleSubmit}
                  disabled={!formData.name.trim() || loading}
                  className="w-full py-2.5 bg-[#ff6b35] hover:bg-[#ff5722] text-white font-semibold rounded-lg shadow-sm hover:shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-[0.98] disabled:scale-100 text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      创建中...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <PlusOutlined />
                      创建群组
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
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