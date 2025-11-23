import React, { useState } from 'react';
import {
  Modal,
  List,
  Card,
  Button,
  Space,
  Avatar,
  Typography,
  Input,
  Form,
  Popconfirm,
  Empty,
  Divider,
  Tag
} from 'antd';
import {
  TeamOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons';
import {
  useGroupsQuery,
  useGroupMembersQuery,
  useContactsQuery
} from '../../../hooks/useContacts';
import { useWallet } from '../../../hooks/useWallet';

const { Text, Title } = Typography;

interface GroupDetailModalProps {
  visible: boolean;
  groupName: string | null;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * 函数级中文注释：分组详情模态框组件
 *
 * 功能特性：
 * - 显示分组详细信息和成员列表
 * - 支持重命名分组
 * - 删除分组功能
 * - 查看分组成员详情
 */
const GroupDetailModal: React.FC<GroupDetailModalProps> = ({
  visible,
  groupName,
  onCancel,
  onSuccess
}) => {
  const { account } = useWallet();
  const currentUser = account?.address || '';
  const [editMode, setEditMode] = useState(false);
  const [form] = Form.useForm();

  // 查询数据
  const { data: groups } = useGroupsQuery(currentUser);
  const { data: groupMembers } = useGroupMembersQuery(currentUser, groupName || undefined);
  const { data: contacts } = useContactsQuery(currentUser);

  // 当前分组信息
  const groupInfo = groups?.find(g => g.name === groupName);

  /**
   * 函数级中文注释：获取分组成员的详细信息
   */
  const getMemberDetails = (memberAccount: string) => {
    return contacts?.find(c => c.account === memberAccount);
  };

  /**
   * 函数级中文注释：处理重命名分组
   */
  const handleRenameGroup = async () => {
    try {
      const values = await form.validateFields();
      // TODO: 实现重命名分组接口
      console.log('重命名分组:', groupName, '->', values.newName);
      setEditMode(false);
      onSuccess();
    } catch (error) {
      console.error('重命名分组失败:', error);
    }
  };

  /**
   * 函数级中文注释：处理删除分组
   */
  const handleDeleteGroup = async () => {
    try {
      // TODO: 实现删除分组接口
      console.log('删除分组:', groupName);
      onSuccess();
    } catch (error) {
      console.error('删除分组失败:', error);
    }
  };

  /**
   * 函数级中文注释：格式化时间显示
   */
  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
  };

  /**
   * 函数级中文注释：渲染成员项
   */
  const renderMemberItem = (memberAccount: string) => {
    const memberDetail = getMemberDetails(memberAccount);

    return (
      <List.Item key={memberAccount}>
        <Card
          size="small"
          hoverable
          style={{ width: '100%', marginBottom: 4 }}
          styles={{ body: { padding: '8px 12px' } }}
          onClick={() => {
            // TODO: 跳转到联系人详情
            console.log('查看联系人详情:', memberAccount);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              size="small"
              style={{ backgroundColor: '#1890ff', marginRight: 8 }}
              icon={<UserOutlined />}
            >
              {memberDetail?.alias ? memberDetail.alias.charAt(0).toUpperCase() : memberAccount.slice(0, 2)}
            </Avatar>

            <div style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: '13px' }}>
                {memberDetail?.alias || `${memberAccount.slice(0, 6)}...${memberAccount.slice(-4)}`}
              </Text>

              {memberDetail?.friendStatus && (
                <div style={{ marginTop: 2 }}>
                  <Tag size="small" color={memberDetail.friendStatus === 'Mutual' ? 'success' : 'warning'}>
                    {memberDetail.friendStatus === 'Mutual' ? '互相关注' : '单向关注'}
                  </Tag>
                </div>
              )}
            </div>
          </div>
        </Card>
      </List.Item>
    );
  };

  if (!groupInfo) {
    return (
      <Modal
        title="分组详情"
        open={visible}
        onCancel={onCancel}
        footer={[
          <Button key="close" onClick={onCancel}>
            关闭
          </Button>
        ]}
      >
        <Empty description="未找到分组信息" />
      </Modal>
    );
  }

  return (
    <Modal
      title={
        <Space>
          <TeamOutlined />
          分组详情
          {editMode && <Tag color="blue">编辑模式</Tag>}
        </Space>
      }
      open={visible}
      onCancel={() => {
        setEditMode(false);
        onCancel();
      }}
      width={500}
      footer={null}
      destroyOnClose
    >
      {/* 分组基本信息 */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '16px' } }}
      >
        {editMode ? (
          <Form
            form={form}
            layout="vertical"
            initialValues={{ newName: groupInfo.name }}
            onFinish={handleRenameGroup}
          >
            <Form.Item
              label="分组名称"
              name="newName"
              rules={[
                { required: true, message: '请输入分组名称' },
                { min: 2, max: 20, message: '分组名称长度为2-20个字符' }
              ]}
            >
              <Input
                placeholder="请输入新的分组名称"
                maxLength={20}
                autoFocus
              />
            </Form.Item>

            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                size="small"
              >
                保存
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={() => setEditMode(false)}
                size="small"
              >
                取消
              </Button>
            </Space>
          </Form>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <Title level={4} style={{ margin: '0 0 8px' }}>
                {groupInfo.name}
              </Title>
              <Text type="secondary">
                共 {groupInfo.memberCount} 位成员 · 创建于 {formatTime(groupInfo.createdAt)}
              </Text>
            </div>

            <Space style={{ width: '100%', justifyContent: 'center' }}>
              <Button
                icon={<EditOutlined />}
                onClick={() => setEditMode(true)}
                size="small"
              >
                重命名
              </Button>

              <Popconfirm
                title="确定要删除这个分组吗？"
                description="删除后，分组内的联系人将不再归属于此分组"
                onConfirm={handleDeleteGroup}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                >
                  删除分组
                </Button>
              </Popconfirm>
            </Space>
          </>
        )}
      </Card>

      {/* 分组成员列表 */}
      <div>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text strong>分组成员</Text>
          <Tag color="blue">{groupMembers?.length || 0} 人</Tag>
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <List
            dataSource={groupMembers || []}
            renderItem={renderMemberItem}
            locale={{
              emptyText: (
                <Empty
                  description="暂无成员"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        </div>
      </div>

      {/* 操作提示 */}
      {groupMembers && groupMembers.length > 0 && (
        <>
          <Divider style={{ margin: '12px 0 8px' }} />
          <Text type="secondary" style={{ fontSize: '11px' }}>
            点击成员可查看详细信息，通过联系人详情页面可修改成员的分组归属
          </Text>
        </>
      )}
    </Modal>
  );
};

export default GroupDetailModal;