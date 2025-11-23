import React from 'react';
import {
  Modal,
  List,
  Card,
  Button,
  Space,
  Avatar,
  Typography,
  Tag,
  Empty,
  Badge,
  Divider,
  message
} from 'antd';
import {
  HeartOutlined,
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  UserOutlined
} from '@ant-design/icons';
import {
  useFriendRequestsQuery,
  useAcceptFriendRequest,
  useRejectFriendRequest
} from '../../../hooks/useContacts';
import { useWallet } from '../../../hooks/useWallet';

const { Text, Title } = Typography;

interface FriendRequestModalProps {
  visible: boolean;
  onCancel: () => void;
}

/**
 * 函数级中文注释：好友申请模态框组件
 *
 * 功能特性：
 * - 显示收到的好友申请列表
 * - 支持接受/拒绝好友申请
 * - 显示申请时间和状态
 * - 过期申请标识
 */
const FriendRequestModal: React.FC<FriendRequestModalProps> = ({
  visible,
  onCancel
}) => {
  const { account } = useWallet();
  const currentUser = account?.address || '';

  // 查询好友申请
  const { data: friendRequests, isLoading, refetch } = useFriendRequestsQuery(currentUser);

  // Mutations
  const acceptMutation = useAcceptFriendRequest();
  const rejectMutation = useRejectFriendRequest();

  /**
   * 函数级中文注释：处理接受好友申请
   */
  const handleAccept = async (requester: string) => {
    try {
      await acceptMutation.mutateAsync(requester);
      refetch(); // 刷新列表
    } catch (error) {
      console.error('接受好友申请失败:', error);
    }
  };

  /**
   * 函数级中文注释：处理拒绝好友申请
   */
  const handleReject = async (requester: string) => {
    try {
      await rejectMutation.mutateAsync(requester);
      refetch(); // 刷新列表
    } catch (error) {
      console.error('拒绝好友申请失败:', error);
    }
  };

  /**
   * 函数级中文注释：检查申请是否过期
   */
  const isRequestExpired = (requestedAt: number) => {
    const now = Math.floor(Date.now() / 1000);
    const expiry = 7 * 24 * 60 * 60; // 7天过期（假设）
    return now - requestedAt > expiry;
  };

  /**
   * 函数级中文注释：格式化时间显示
   */
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  /**
   * 函数级中文注释：渲染好友申请项
   */
  const renderRequestItem = (request: any) => {
    const expired = isRequestExpired(request.requestedAt);

    return (
      <List.Item key={request.from}>
        <Card
          size="small"
          style={{
            width: '100%',
            marginBottom: 8,
            opacity: expired ? 0.6 : 1
          }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* 申请人信息 */}
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <Avatar
                size="default"
                style={{ backgroundColor: '#1890ff', marginRight: 12 }}
                icon={<UserOutlined />}
              >
                {request.from.slice(0, 2)}
              </Avatar>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <Text strong style={{ marginRight: 8 }}>
                    {`${request.from.slice(0, 6)}...${request.from.slice(-4)}`}
                  </Text>

                  {expired && (
                    <Tag color="red" size="small">
                      已过期
                    </Tag>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#666' }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {formatTime(request.requestedAt)}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            {!expired && (
              <Space>
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => handleAccept(request.from)}
                  loading={acceptMutation.isPending}
                  disabled={rejectMutation.isPending}
                >
                  接受
                </Button>
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => handleReject(request.from)}
                  loading={rejectMutation.isPending}
                  disabled={acceptMutation.isPending}
                >
                  拒绝
                </Button>
              </Space>
            )}

            {expired && (
              <Button
                size="small"
                type="text"
                onClick={() => handleReject(request.from)}
                loading={rejectMutation.isPending}
                style={{ color: '#999' }}
              >
                删除
              </Button>
            )}
          </div>
        </Card>
      </List.Item>
    );
  };

  // 统计未过期的申请数量
  const validRequestsCount = friendRequests?.filter(r => !isRequestExpired(r.requestedAt)).length || 0;

  return (
    <Modal
      title={
        <Space>
          <Badge count={validRequestsCount} offset={[10, 0]}>
            <HeartOutlined />
          </Badge>
          好友申请
          {validRequestsCount > 0 && (
            <Tag color="red" size="small">
              {validRequestsCount} 个待处理
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
      {/* 友善提示 */}
      {validRequestsCount > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 16, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}
          styles={{ body: { padding: '8px 12px' } }}
        >
          <Text type="success" style={{ fontSize: '12px' }}>
            💡 接受好友申请后，双方将建立互相关注关系，可以进行聊天交流
          </Text>
        </Card>
      )}

      {/* 好友申请列表 */}
      <List
        loading={isLoading}
        dataSource={friendRequests || []}
        renderItem={renderRequestItem}
        locale={{
          emptyText: (
            <Empty
              description="暂无好友申请"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )
        }}
      />

      {/* 底部说明 */}
      {friendRequests && friendRequests.length > 0 && (
        <>
          <Divider style={{ margin: '16px 0 8px' }} />
          <Text type="secondary" style={{ fontSize: '11px' }}>
            好友申请有效期为7天，过期后需要重新发送申请
          </Text>
        </>
      )}
    </Modal>
  );
};

export default FriendRequestModal;