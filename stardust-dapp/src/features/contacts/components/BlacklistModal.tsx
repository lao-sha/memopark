import React from 'react';
import {
  Modal,
  List,
  Card,
  Button,
  Space,
  Avatar,
  Typography,
  Popconfirm,
  Empty,
  Tag,
  Divider
} from 'antd';
import {
  BlockOutlined,
  DeleteOutlined,
  UserDeleteOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useBlacklistQuery, useUnblockAccount } from '../../../hooks/useContacts';
import { useWallet } from '../../../hooks/useWallet';

const { Text, Title } = Typography;

interface BlacklistModalProps {
  visible: boolean;
  onCancel: () => void;
}

/**
 * 函数级中文注释：黑名单管理模态框组件
 *
 * 功能特性：
 * - 显示已屏蔽的用户列表
 * - 支持移除黑名单
 * - 显示屏蔽原因和时间
 * - 批量管理功能
 */
const BlacklistModal: React.FC<BlacklistModalProps> = ({
  visible,
  onCancel
}) => {
  const { account } = useWallet();
  const currentUser = account?.address || '';

  // 查询黑名单
  const { data: blacklist, isLoading, refetch } = useBlacklistQuery(currentUser);

  // Mutation
  const unblockMutation = useUnblockAccount();

  /**
   * 函数级中文注释：处理移除黑名单
   */
  const handleUnblock = async (targetAccount: string) => {
    try {
      await unblockMutation.mutateAsync(targetAccount);
      refetch(); // 刷新列表
    } catch (error) {
      console.error('移除黑名单失败:', error);
    }
  };

  /**
   * 函数级中文注释：格式化时间显示
   */
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 30) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  /**
   * 函数级中文注释：渲染黑名单项
   */
  const renderBlockedItem = (blockedUser: any) => {
    return (
      <List.Item key={blockedUser.account}>
        <Card
          size="small"
          style={{ width: '100%', marginBottom: 8 }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* 用户信息 */}
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <Avatar
                size="default"
                style={{ backgroundColor: '#ff4d4f', marginRight: 12 }}
                icon={<UserDeleteOutlined />}
              >
                {blockedUser.account.slice(0, 2)}
              </Avatar>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 4 }}>
                  <Text strong style={{ fontSize: '14px' }}>
                    {`${blockedUser.account.slice(0, 6)}...${blockedUser.account.slice(-4)}`}
                  </Text>
                </div>

                {/* 屏蔽原因 */}
                {blockedUser.reason && (
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      原因：{blockedUser.reason}
                    </Text>
                  </div>
                )}

                {/* 屏蔽时间 */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: '#999' }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {formatTime(blockedUser.blockedAt)}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <Popconfirm
              title="确定要移除此用户的屏蔽吗？"
              description="移除后，该用户可以重新联系您"
              onConfirm={() => handleUnblock(blockedUser.account)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                size="small"
                icon={<DeleteOutlined />}
                danger
                loading={unblockMutation.isPending}
              >
                解除屏蔽
              </Button>
            </Popconfirm>
          </div>
        </Card>
      </List.Item>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <BlockOutlined />
          黑名单管理
          {blacklist && blacklist.length > 0 && (
            <Tag color="red" size="small">
              {blacklist.length} 个已屏蔽
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>
      ]}
      width={500}
      style={{ maxHeight: '80vh' }}
      styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
    >
      {/* 功能说明 */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          backgroundColor: '#fff2e8',
          border: '1px solid #ffbb96'
        }}
        styles={{ body: { padding: '8px 12px' } }}
      >
        <Text style={{ fontSize: '12px', color: '#d4380d' }}>
          ⚠️ 已屏蔽的用户无法向您发送消息或好友申请，解除屏蔽后可恢复正常联系
        </Text>
      </Card>

      {/* 黑名单列表 */}
      <List
        loading={isLoading}
        dataSource={blacklist || []}
        renderItem={renderBlockedItem}
        locale={{
          emptyText: (
            <Empty
              description="黑名单为空"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Text type="secondary" style={{ fontSize: '12px' }}>
                您还没有屏蔽任何用户
              </Text>
            </Empty>
          )
        }}
      />

      {/* 底部说明 */}
      {blacklist && blacklist.length > 0 && (
        <>
          <Divider style={{ margin: '16px 0 8px' }} />
          <Text type="secondary" style={{ fontSize: '11px' }}>
            黑名单功能可保护您免受骚扰，被屏蔽的用户将无法主动联系您
          </Text>
        </>
      )}
    </Modal>
  );
};

export default BlacklistModal;