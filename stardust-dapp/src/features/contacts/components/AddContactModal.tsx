import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  Divider,
  Typography,
  Card,
  Tag
} from 'antd';
import {
  UserAddOutlined,
  ScanOutlined,
  TeamOutlined,
  HeartOutlined
} from '@ant-design/icons';
import { useAddContact, useSendFriendRequest, useGroupsQuery } from '../../../hooks/useContacts';
import { useWallet } from '../../../hooks/useWallet';

const { Option } = Select;
const { Text } = Typography;

interface AddContactModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * 函数级中文注释：添加联系人模态框组件
 *
 * 功能特性：
 * - 支持直接添加联系人
 * - 支持发送好友申请
 * - 可选择分组归属
 * - 地址格式验证
 * - 二维码扫描（占位）
 */
const AddContactModal: React.FC<AddContactModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const { account } = useWallet();
  const currentUser = account?.address || '';
  const [addType, setAddType] = useState<'direct' | 'request'>('request'); // 默认使用"发送好友申请"模式（推荐）

  // 查询分组列表用于选择
  const { data: groups } = useGroupsQuery(currentUser);

  // Mutations
  const addContactMutation = useAddContact();
  const sendRequestMutation = useSendFriendRequest();

  /**
   * 函数级中文注释：处理表单提交
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (addType === 'direct') {
        // 直接添加联系人
        await addContactMutation.mutateAsync({
          contact: values.contact,
          alias: values.alias,
          groups: values.groups || []
        });
      } else {
        // 发送好友申请
        await sendRequestMutation.mutateAsync({
          target: values.contact,
          message: values.message
        });
      }

      form.resetFields();
      onSuccess();
    } catch (error) {
      console.error('操作失败:', error);
    }
  };

  /**
   * 函数级中文注释：处理取消操作
   */
  const handleCancel = () => {
    form.resetFields();
    setAddType('request'); // 重置为默认的"发送好友申请"模式
    onCancel();
  };

  /**
   * 函数级中文注释：验证账户地址格式
   */
  const validateAccount = (_: any, value: string) => {
    if (!value) {
      return Promise.reject('请输入联系人地址');
    }

    // 简单的Substrate地址格式验证
    if (value.length < 40 || (!value.startsWith('5') && !value.startsWith('1'))) {
      return Promise.reject('请输入有效的账户地址');
    }

    if (value === currentUser) {
      return Promise.reject('不能添加自己为联系人');
    }

    return Promise.resolve();
  };

  return (
    <Modal
      title={
        <Space>
          <UserAddOutlined />
          {addType === 'direct' ? '添加联系人' : '发送好友申请'}
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={400}
      destroyOnHidden
    >
      {/* 添加方式选择 */}
      <Card
        size="small"
        styles={{ body: { padding: '12px 16px' } }}
        style={{ marginBottom: 16 }}
      >
        <Text type="secondary" style={{ fontSize: '12px', marginBottom: 8, display: 'block' }}>
          选择添加方式：
        </Text>

        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button
            type={addType === 'request' ? 'primary' : 'default'}
            icon={<HeartOutlined />}
            onClick={() => setAddType('request')}
            style={{
              flex: 1,
              borderRadius: '20px',
              backgroundColor: addType === 'request' ? '#B8860B' : 'white',
              borderColor: '#B8860B',
              color: addType === 'request' ? 'white' : '#B8860B'
            }}
          >
            发送申请 ⭐
          </Button>
          <Button
            type={addType === 'direct' ? 'primary' : 'default'}
            onClick={() => setAddType('direct')}
            style={{
              flex: 1,
              borderRadius: '20px',
              backgroundColor: addType === 'direct' ? '#B8860B' : 'white',
              borderColor: '#B8860B',
              color: addType === 'direct' ? 'white' : '#B8860B'
            }}
          >
            直接添加
          </Button>
        </Space>

        <Text type="secondary" style={{ fontSize: '11px', marginTop: 8, display: 'block' }}>
          {addType === 'request'
            ? '✅ 推荐：发送好友申请，双方确认后建立双向好友关系'
            : '⚠️ 单向添加到本地通讯录，对方不会收到任何通知'
          }
        </Text>
      </Card>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        {/* 联系人地址 */}
        <Form.Item
          label="联系人地址"
          name="contact"
          rules={[{ validator: validateAccount }]}
        >
          <Input
            placeholder="请输入或扫描对方的账户地址"
            suffix={
              <Button
                type="text"
                icon={<ScanOutlined />}
                size="small"
                onClick={() => message.info('扫描功能开发中')}
              />
            }
          />
        </Form.Item>

        {/* 备注名称 */}
        <Form.Item
          label="备注名称"
          name="alias"
        >
          <Input
            placeholder="为联系人设置一个易记的名称（可选）"
            maxLength={32}
          />
        </Form.Item>

        {addType === 'direct' ? (
          // 直接添加模式的表单项
          <Form.Item
            label="选择分组"
            name="groups"
          >
            <Select
              mode="multiple"
              placeholder="选择分组（可选）"
              allowClear
              maxTagCount={3}
              maxTagTextLength={6}
            >
              {groups?.map(group => (
                <Option key={group.name} value={group.name}>
                  <Space>
                    <TeamOutlined />
                    {group.name}
                    <Tag size="small" color="blue">
                      {group.memberCount}
                    </Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
        ) : (
          // 好友申请模式的表单项
          <Form.Item
            label="申请留言"
            name="message"
          >
            <Input.TextArea
              placeholder="写点什么介绍一下自己吧（可选）"
              maxLength={100}
              rows={3}
              showCount
            />
          </Form.Item>
        )}

        <Divider style={{ margin: '16px 0' }} />

        {/* 底部操作按钮 */}
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={handleCancel} style={{ borderRadius: '20px' }}>
            取消
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={addContactMutation.isPending || sendRequestMutation.isPending}
            icon={addType === 'direct' ? <UserAddOutlined /> : <HeartOutlined />}
            style={{
              borderRadius: '20px',
              backgroundColor: '#B8860B',
              borderColor: '#B8860B'
            }}
          >
            {addType === 'direct' ? '添加联系人' : '发送申请'}
          </Button>
        </Space>
      </Form>
    </Modal>
  );
};

export default AddContactModal;