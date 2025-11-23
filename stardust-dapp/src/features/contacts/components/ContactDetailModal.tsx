import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Descriptions,
  Avatar,
  Tag,
  Divider,
  Typography,
  Card,
  Popconfirm,
  Alert
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  MessageOutlined,
  BlockOutlined,
  UserOutlined,
  HeartOutlined,
  TeamOutlined
} from '@ant-design/icons';
import {
  useContactsQuery,
  useRemoveContact,
  useBlockAccount,
  useGroupsQuery
} from '../../../hooks/useContacts';
import { useWallet } from '../../../hooks/useWallet';

const { Option } = Select;
const { Text, Title } = Typography;

interface ContactDetailModalProps {
  visible: boolean;
  contactAccount: string | null;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * 函数级中文注释：联系人详情模态框组件
 *
 * 功能特性：
 * - 显示联系人详细信息
 * - 支持编辑联系人信息
 * - 删除联系人功能
 * - 屏蔽联系人功能
 * - 快速聊天跳转
 */
const ContactDetailModal: React.FC<ContactDetailModalProps> = ({
  visible,
  contactAccount,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const { account } = useWallet();
  const currentUser = account?.address || '';
  const [editMode, setEditMode] = useState(false);

  // 查询数据
  const { data: contacts } = useContactsQuery(currentUser);
  const { data: groups } = useGroupsQuery(currentUser);

  // Mutations
  const removeContactMutation = useRemoveContact();
  const blockAccountMutation = useBlockAccount();

  // 当前联系人信息
  const contactInfo = contacts?.find(c => c.account === contactAccount);

  /**
   * 函数级中文注释：表单初始化
   */
  useEffect(() => {
    if (contactInfo && visible) {
      form.setFieldsValue({
        alias: contactInfo.alias || '',
        groups: contactInfo.groups || []
      });
    }
  }, [contactInfo, visible, form]);

  /**
   * 函数级中文注释：处理删除联系人
   */
  const handleRemoveContact = async () => {
    if (!contactAccount) return;

    try {
      await removeContactMutation.mutateAsync(contactAccount);
      onSuccess();
    } catch (error) {
      console.error('删除联系人失败:', error);
    }
  };

  /**
   * 函数级中文注释：处理屏蔽联系人
   */
  const handleBlockContact = async () => {
    if (!contactAccount) return;

    try {
      await blockAccountMutation.mutateAsync({
        target: contactAccount,
        reason: '通过联系人详情页面屏蔽'
      });
      onSuccess();
    } catch (error) {
      console.error('屏蔽联系人失败:', error);
    }
  };

  /**
   * 函数级中文注释：处理更新联系人信息
   */
  const handleUpdateContact = async () => {
    try {
      const values = await form.validateFields();
      // TODO: 实现更新联系人接口
      console.log('更新联系人信息:', values);
      setEditMode(false);
      onSuccess();
    } catch (error) {
      console.error('更新联系人失败:', error);
    }
  };

  /**
   * 函数级中文注释：处理跳转聊天
   */
  const handleStartChat = () => {
    if (!contactAccount) return;

    // TODO: 跳转到聊天页面
    window.location.hash = `#/chat?with=${contactAccount}`;
    onCancel();
  };

  /**
   * 函数级中文注释：格式化时间显示
   */
  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  /**
   * 函数级中文注释：获取好友状态描述
   */
  const getFriendStatusInfo = (status: string) => {
    const statusMap = {
      'Mutual': { text: '互相关注', color: 'success', icon: '💚' },
      'OneWay': { text: '单向关注', color: 'warning', icon: '🟡' },
      'Pending': { text: '待确认', color: 'processing', icon: '⏳' }
    };
    return statusMap[status] || statusMap['OneWay'];
  };

  if (!contactInfo) {
    return (
      <Modal
        title="联系人详情"
        open={visible}
        onCancel={onCancel}
        footer={[
          <Button key="close" onClick={onCancel}>
            关闭
          </Button>
        ]}
      >
        <Alert message="未找到联系人信息" type="warning" />
      </Modal>
    );
  }

  const statusInfo = getFriendStatusInfo(contactInfo.friendStatus);

  return (
    <Modal
      title={
        <Space>
          <UserOutlined />
          联系人详情
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
      destroyOnHidden
    >
      {/* 联系人头像和基本信息 */}
      <Card
        size="small"
        styles={{ body: { padding: '16px', textAlign: 'center' } }}
        style={{ marginBottom: 16 }}
      >
        <Avatar
          size={64}
          style={{ backgroundColor: '#1890ff', marginBottom: 12 }}
        >
          {contactInfo.alias ? contactInfo.alias.charAt(0).toUpperCase() : contactInfo.account.slice(0, 2)}
        </Avatar>

        <Title level={4} style={{ margin: '8px 0' }}>
          {contactInfo.alias || `${contactInfo.account.slice(0, 6)}...${contactInfo.account.slice(-4)}`}
        </Title>

        <div style={{ marginBottom: 8 }}>
          <Tag color={statusInfo.color}>
            {statusInfo.icon} {statusInfo.text}
          </Tag>
        </div>

        <Text type="secondary" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
          {contactInfo.account}
        </Text>
      </Card>

      {/* 编辑表单或详情展示 */}
      {editMode ? (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateContact}
        >
          <Form.Item
            label="备注名称"
            name="alias"
          >
            <Input
              placeholder="为联系人设置一个易记的名称"
              maxLength={32}
            />
          </Form.Item>

          <Form.Item
            label="所属分组"
            name="groups"
          >
            <Select
              mode="multiple"
              placeholder="选择分组"
              allowClear
              maxTagCount={3}
            >
              {groups?.map(group => (
                <Option key={group.name} value={group.name}>
                  <Space>
                    <TeamOutlined />
                    {group.name}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditMode(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Space>
        </Form>
      ) : (
        <Descriptions column={1} size="small">
          <Descriptions.Item label="备注名称">
            {contactInfo.alias || <Text type="secondary">未设置</Text>}
          </Descriptions.Item>

          <Descriptions.Item label="所属分组">
            {contactInfo.groups && contactInfo.groups.length > 0 ? (
              <Space wrap>
                {contactInfo.groups.map((group: string) => (
                  <Tag key={group} icon={<TeamOutlined />} color="blue">
                    {group}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">未归属任何分组</Text>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="好友状态">
            <Tag color={statusInfo.color}>
              {statusInfo.icon} {statusInfo.text}
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="添加时间">
            {formatTime(contactInfo.addedAt)}
          </Descriptions.Item>

          <Descriptions.Item label="更新时间">
            {formatTime(contactInfo.updatedAt)}
          </Descriptions.Item>
        </Descriptions>
      )}

      {!editMode && (
        <>
          <Divider />

          {/* 操作按钮 */}
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              {contactInfo.friendStatus === 'Mutual' && (
                <Button
                  type="primary"
                  icon={<MessageOutlined />}
                  onClick={handleStartChat}
                >
                  聊天
                </Button>
              )}

              <Button
                icon={<EditOutlined />}
                onClick={() => setEditMode(true)}
              >
                编辑
              </Button>
            </Space>

            <Space>
              <Popconfirm
                title="确定要删除这个联系人吗？"
                description="删除后将从通讯录中移除，但不会影响对方"
                onConfirm={handleRemoveContact}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={removeContactMutation.isPending}
                >
                  删除
                </Button>
              </Popconfirm>

              <Popconfirm
                title="确定要屏蔽这个联系人吗？"
                description="屏蔽后对方将无法联系您，且会自动从通讯录删除"
                onConfirm={handleBlockContact}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<BlockOutlined />}
                  loading={blockAccountMutation.isPending}
                >
                  屏蔽
                </Button>
              </Popconfirm>
            </Space>
          </Space>
        </>
      )}
    </Modal>
  );
};

export default ContactDetailModal;