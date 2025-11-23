import React, { useState } from 'react';
import {
  List,
  Card,
  Button,
  Space,
  Input,
  Tabs,
  Badge,
  Dropdown,
  FloatButton,
  Empty,
  Avatar,
  Typography,
  Tag,
  Modal
} from 'antd';
import {
  UserAddOutlined,
  TeamOutlined,
  BlockOutlined,
  SearchOutlined,
  MoreOutlined,
  HeartOutlined,
  UsergroupAddOutlined,
  SettingOutlined,
  MessageOutlined,
  CalendarOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useContactsQuery, useGroupsQuery, useBlacklistQuery } from '../../hooks/useContacts';
import { useWallet } from '../../hooks/useWallet';
import { SmartChatService, GroupInfo } from '../../services/smartChatService';
import { useQuery } from '@tanstack/react-query';
import AddContactModal from './components/AddContactModal';
import ContactDetailModal from './components/ContactDetailModal';
import CreateGroupModal from './components/CreateGroupModal';
import GroupDetailModal from './components/GroupDetailModal';
import BlacklistModal from './components/BlacklistModal';
import FriendRequestModal from './components/FriendRequestModal';
import './ContactsPage.css';

const { Search } = Input;
const { Text } = Typography;

/**
 * 函数级中文注释：通讯录主页面组件
 *
 * 核心功能：
 * - 联系人列表展示与管理（添加、删除、修改）
 * - 分组管理（创建、删除、重命名）
 * - 黑名单管理
 * - 好友申请处理
 * - 搜索过滤功能
 *
 * 特色设计：
 * - 移动端优先，纪念馆风格
 * - 分标签页展示不同类型联系人
 * - 支持快速操作和批量管理
 */
const ContactsPage: React.FC = () => {
  const { account } = useWallet();

  // 获取当前用户地址
  const currentUser = account?.address || '';

  // 模态框控制状态
  const [addContactVisible, setAddContactVisible] = useState(false);
  const [contactDetailVisible, setContactDetailVisible] = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [groupDetailVisible, setGroupDetailVisible] = useState(false);
  const [blacklistVisible, setBlacklistVisible] = useState(false);
  const [friendRequestVisible, setFriendRequestVisible] = useState(false);

  // 选中的联系人/分组
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // 搜索关键词
  const [searchText, setSearchText] = useState('');

  // 当前标签页
  const [activeTab, setActiveTab] = useState('contacts');

  // 查询数据
  const { data: contacts, isLoading: contactsLoading } = useContactsQuery(currentUser);
  const { data: groups, isLoading: groupsLoading } = useGroupsQuery(currentUser);
  const { data: blacklist, isLoading: blacklistLoading } = useBlacklistQuery(currentUser);

  // 🆕 查询用户加入的群聊列表
  const smartChatService = React.useMemo(() => new SmartChatService(), []);
  const { data: joinedGroups, isLoading: joinedGroupsLoading, error: joinedGroupsError } = useQuery<GroupInfo[]>({
    queryKey: ['joinedGroups', currentUser],
    queryFn: async () => {
      console.log('获取群聊列表，当前用户:', currentUser);
      if (!currentUser) {
        console.log('用户地址为空，返回空数组');
        return [];
      }
      try {
        const groups = await smartChatService.getUserGroups(currentUser);
        console.log('获取到的群聊列表:', groups);
        return groups;
      } catch (error) {
        console.error('获取群聊列表失败:', error);
        throw error;
      }
    },
    enabled: !!currentUser,
    refetchInterval: 10000, // 每10秒刷新一次
  });

  // 调试输出
  React.useEffect(() => {
    console.log('通讯录页面状态:', {
      currentUser,
      joinedGroupsLoading,
      joinedGroups,
      joinedGroupsError,
      account
    });
  }, [currentUser, joinedGroupsLoading, joinedGroups, joinedGroupsError, account]);

  /**
   * 函数级中文注释：处理返回聊天界面
   * 检查用户是否来自智能聊天页面，如有则返回；否则返回到智能聊天主页
   */
  const handleBackToChat = () => {
    // 检查来源页面是否是聊天页面
    const referrer = document.referrer;
    const currentOrigin = window.location.origin;

    if (referrer && referrer.startsWith(currentOrigin) && referrer.includes('#/smart-chat')) {
      // 如果是从聊天页面过来的，返回到聊天页面
      window.history.back();
    } else {
      // 否则返回到智能聊天主页
      window.location.hash = '#/smart-chat';
    }
  };

  /**
   * 函数级中文注释：过滤联系人列表
   * 根据搜索关键词和好友状态筛选联系人
   */
  const filteredContacts = React.useMemo(() => {
    if (!contacts) return [];

    return contacts.filter(contact => {
      // 搜索过滤
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchName = contact.alias?.toLowerCase().includes(searchLower);
        const matchAddress = contact.account.toLowerCase().includes(searchLower);
        if (!matchName && !matchAddress) return false;
      }

      // 标签页过滤
      if (activeTab === 'mutual') {
        return contact.friendStatus === 'Mutual';
      } else if (activeTab === 'oneway') {
        return contact.friendStatus === 'OneWay';
      } else if (activeTab === 'pending') {
        return contact.friendStatus === 'Pending';
      }

      return true;
    });
  }, [contacts, searchText, activeTab]);

  /**
   * 函数级中文注释：处理联系人详情查看
   */
  const handleContactDetail = (contactAccount: string) => {
    setSelectedContact(contactAccount);
    setContactDetailVisible(true);
  };

  /**
   * 函数级中文注释：处理分组详情查看
   */
  const handleGroupDetail = (groupName: string) => {
    setSelectedGroup(groupName);
    setGroupDetailVisible(true);
  };

  /**
   * 函数级中文注释：处理进入群聊
   * 点击群聊群号时跳转到群聊页面
   * 使用 hash 路由系统进行页面跳转
   */
  const handleEnterGroupChat = (groupId: string) => {
    window.location.hash = `#/smart-chat?groupId=${groupId}`;
  };

  /**
   * 函数级中文注释：渲染联系人项
   */
  const renderContactItem = (contact: any) => {
    const statusColors = {
      'Mutual': 'success',
      'OneWay': 'warning',
      'Pending': 'processing'
    };

    const statusTexts = {
      'Mutual': '互相关注',
      'OneWay': '单向关注',
      'Pending': '待确认'
    };

    return (
      <List.Item
        key={contact.account}
        onClick={() => handleContactDetail(contact.account)}
        className="contact-item-wrapper"
      >
        <Card
          hoverable
          className="contact-card"
          styles={{ body: { padding: '12px 16px' } }}
        >
          <div className="contact-content">
            <div className="contact-info-section">
              <Avatar
                className="contact-avatar"
                size="default"
              >
                {contact.alias ? contact.alias.charAt(0).toUpperCase() : contact.account.slice(0, 2)}
              </Avatar>

              <div className="contact-details">
                <div className="contact-name-row">
                  <Text strong className="contact-name">
                    {contact.alias || `${contact.account.slice(0, 6)}...${contact.account.slice(-4)}`}
                  </Text>
                  <Badge
                    status={statusColors[contact.friendStatus]}
                    text={statusTexts[contact.friendStatus]}
                    className="contact-status"
                  />
                </div>

                {contact.groups && contact.groups.length > 0 && (
                  <div className="contact-groups">
                    {contact.groups.map((group: string) => (
                      <Tag key={group} className="group-tag" color="blue">
                        {group}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Space className="contact-actions">
              {contact.friendStatus === 'Mutual' && (
                <Button
                  type="text"
                  icon={<MessageOutlined />}
                  size="small"
                  className="action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: 跳转到聊天页面
                  }}
                />
              )}
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'edit',
                      label: '编辑',
                      icon: <SettingOutlined />
                    },
                    {
                      key: 'remove',
                      label: '删除',
                      danger: true
                    }
                  ],
                  onClick: (e) => {
                    e.domEvent.stopPropagation();
                    // TODO: 处理菜单点击
                  }
                }}
              >
                <Button
                  type="text"
                  icon={<MoreOutlined />}
                  size="small"
                  className="action-btn"
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            </Space>
          </div>
        </Card>
      </List.Item>
    );
  };

  /**
   * 函数级中文注释：渲染分组项
   */
  const renderGroupItem = (group: any) => (
    <List.Item
      key={group.name}
      onClick={() => handleGroupDetail(group.name)}
      className="group-item-wrapper"
    >
      <Card
        hoverable
        className="group-card"
        styles={{ body: { padding: '12px 16px' } }}
      >
        <div className="group-content">
          <div className="group-info-section">
            <TeamOutlined className="group-icon" />
            <div className="group-details">
              <Text strong className="group-name">{group.name}</Text>
              <Text className="group-count">{group.memberCount} 位成员</Text>
            </div>
          </div>

          <Button
            type="text"
            icon={<MoreOutlined />}
            size="small"
            className="action-btn"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </Card>
    </List.Item>
  );

  /**
   * 函数级中文注释：渲染群聊项 (智能群聊)
   * 显示已加入的群聊信息，点击可进入群聊
   */
  const renderGroupChatItem = (groupChat: GroupInfo) => {
    console.log('渲染群聊项:', groupChat);

    // 加密模式显示
    const encryptionModeColors = {
      'Military': 'red',
      'Business': 'blue',
      'Selective': 'orange',
      'Transparent': 'green'
    };

    const encryptionModeTexts = {
      'Military': '军用级',
      'Business': '商用级',
      'Selective': '选择性',
      'Transparent': '透明'
    };

    return (
      <List.Item
        key={groupChat.id}
        onClick={() => handleEnterGroupChat(groupChat.id)}
        className="group-chat-item-wrapper"
      >
        <Card
          hoverable
          className="group-chat-card"
          styles={{ body: { padding: '12px 16px' } }}
        >
          <div className="group-chat-content">
            <div className="group-chat-info-section">
              <Avatar
                className="group-chat-avatar"
                size="default"
                icon={<TeamOutlined />}
                style={{ backgroundColor: '#1890ff' }}
              />

              <div className="group-chat-details">
                <div className="group-chat-name-row">
                  <Text strong className="group-chat-name">
                    {groupChat.name}
                  </Text>
                  <Tag
                    color={encryptionModeColors[groupChat.encryptionMode]}
                    className="encryption-tag"
                  >
                    {encryptionModeTexts[groupChat.encryptionMode]}
                  </Tag>
                </div>

                <div className="group-chat-meta">
                  <Text className="group-chat-id">群号: {groupChat.id}</Text>
                  <Text className="group-chat-member-count">
                    {groupChat.memberCount} 位成员
                  </Text>
                  {groupChat.isPublic && (
                    <Tag color="green" className="public-tag">公开</Tag>
                  )}
                </div>

                {groupChat.description && (
                  <Text className="group-chat-description" ellipsis>
                    {groupChat.description}
                  </Text>
                )}
              </div>
            </div>

            <Space className="group-chat-actions">
              <Button
                type="primary"
                icon={<MessageOutlined />}
                size="small"
                className="action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnterGroupChat(groupChat.id);
                }}
              >
                进入
              </Button>
            </Space>
          </div>
        </Card>
      </List.Item>
    );
  };

  /**
   * 函数级中文注释：标签页配置
   */
  const tabItems = [
    {
      key: 'contacts',
      label: `全部联系人 ${contacts ? `(${contacts.length})` : ''}`,
      children: (
        <List
          className="contacts-list"
          loading={contactsLoading}
          dataSource={filteredContacts}
          renderItem={renderContactItem}
          locale={{ emptyText: <Empty description="暂无联系人" /> }}
        />
      )
    },
    {
      key: 'mutual',
      label: `互相关注 ${contacts ? `(${contacts.filter(c => c.friendStatus === 'Mutual').length})` : ''}`,
      children: (
        <List
          className="contacts-list"
          loading={contactsLoading}
          dataSource={filteredContacts}
          renderItem={renderContactItem}
          locale={{ emptyText: <Empty description="暂无互相关注的联系人" /> }}
        />
      )
    },
    {
      key: 'groupChats',
      label: `群聊 ${joinedGroups ? `(${joinedGroups.length})` : ''}`,
      children: (
        <List
          className="group-chats-list"
          loading={joinedGroupsLoading}
          dataSource={joinedGroups || []}
          renderItem={renderGroupChatItem}
          locale={{ emptyText: <Empty description="暂无加入的群聊" /> }}
        />
      )
    },
    {
      key: 'groups',
      label: `分组 ${groups ? `(${groups.length})` : ''}`,
      children: (
        <List
          className="groups-list"
          loading={groupsLoading}
          dataSource={groups || []}
          renderItem={renderGroupItem}
          locale={{ emptyText: <Empty description="暂无分组" /> }}
        />
      )
    }
  ];

  return (
    <div className="contacts-page">
      {/* 顶部搜索栏 - 纪念馆风格 */}
      <div className="header-search">
        <div className="search-container">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBackToChat}
            className="back-btn"
            title="返回聊天"
          />
          <Search
            placeholder="搜索联系人或分组"
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="search-input"
            prefix={<SearchOutlined />}
          />
          <CalendarOutlined className="calendar-icon" />
        </div>
      </div>

      {/* 快速操作按钮区域 */}
      <div className="quick-actions">
        <Space className="action-buttons">
          <Button
            type="primary"
            icon={<HeartOutlined />}
            onClick={() => setAddContactVisible(true)}
            className="primary-btn"
          >
            添加好友
          </Button>
          <Button
            icon={<UsergroupAddOutlined />}
            onClick={() => setCreateGroupVisible(true)}
            className="secondary-btn"
          >
            创建分组
          </Button>
          <Button
            icon={<UserAddOutlined />}
            onClick={() => setFriendRequestVisible(true)}
            className="secondary-btn"
          >
            好友申请
          </Button>
        </Space>
      </div>

      {/* 主要内容标签页 */}
      <div className="page-content">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="contacts-tabs"
        />
      </div>

      {/* 悬浮操作按钮 */}
      <FloatButton.Group>
        <FloatButton
          icon={<BlockOutlined />}
          tooltip="黑名单管理"
          onClick={() => setBlacklistVisible(true)}
        />
        <FloatButton
          icon={<HeartOutlined />}
          type="primary"
          tooltip="添加好友"
          onClick={() => setAddContactVisible(true)}
        />
      </FloatButton.Group>

      {/* 模态框组件 */}
      <AddContactModal
        visible={addContactVisible}
        onCancel={() => setAddContactVisible(false)}
        onSuccess={() => setAddContactVisible(false)}
      />

      <ContactDetailModal
        visible={contactDetailVisible}
        contactAccount={selectedContact}
        onCancel={() => setContactDetailVisible(false)}
        onSuccess={() => setContactDetailVisible(false)}
      />

      <CreateGroupModal
        visible={createGroupVisible}
        onCancel={() => setCreateGroupVisible(false)}
        onSuccess={() => setCreateGroupVisible(false)}
      />

      <GroupDetailModal
        visible={groupDetailVisible}
        groupName={selectedGroup}
        onCancel={() => setGroupDetailVisible(false)}
        onSuccess={() => setGroupDetailVisible(false)}
      />

      <BlacklistModal
        visible={blacklistVisible}
        onCancel={() => setBlacklistVisible(false)}
      />

      <FriendRequestModal
        visible={friendRequestVisible}
        onCancel={() => setFriendRequestVisible(false)}
      />
    </div>
  );
};

export default ContactsPage;