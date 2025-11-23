import React from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  Typography
} from 'antd';
import {
  TeamOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useCreateGroup } from '../../../hooks/useContacts';

const { Text } = Typography;

interface CreateGroupModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * 函数级中文注释：创建分组模态框组件
 *
 * 功能特性：
 * - 创建新的联系人分组
 * - 分组名称验证
 * - 创建成功后自动关闭
 */
const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();

  // Mutation
  const createGroupMutation = useCreateGroup();

  /**
   * 函数级中文注释：处理表单提交
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createGroupMutation.mutateAsync(values.groupName);

      form.resetFields();
      onSuccess();
    } catch (error) {
      console.error('创建分组失败:', error);
    }
  };

  /**
   * 函数级中文注释：处理取消操作
   */
  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  /**
   * 函数级中文注释：验证分组名称
   */
  const validateGroupName = (_: any, value: string) => {
    if (!value || !value.trim()) {
      return Promise.reject('请输入分组名称');
    }

    if (value.trim().length < 2) {
      return Promise.reject('分组名称至少2个字符');
    }

    if (value.trim().length > 20) {
      return Promise.reject('分组名称最多20个字符');
    }

    // 检查特殊字符
    const invalidChars = /[<>:"'/\\|?*]/;
    if (invalidChars.test(value)) {
      return Promise.reject('分组名称不能包含特殊字符');
    }

    return Promise.resolve();
  };

  return (
    <Modal
      title={
        <Space>
          <TeamOutlined />
          创建分组
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={400}
      destroyOnHidden
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          创建分组来更好地管理您的联系人，可以按家庭、朋友、同事等类别进行分组
        </Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          label="分组名称"
          name="groupName"
          rules={[{ validator: validateGroupName }]}
        >
          <Input
            placeholder="请输入分组名称（如：家人、朋友、同事）"
            maxLength={20}
            showCount
            autoFocus
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel}>
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createGroupMutation.isPending}
              icon={<PlusOutlined />}
            >
              创建分组
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {/* 分组使用提示 */}
      <div style={{
        marginTop: 16,
        padding: '8px 12px',
        backgroundColor: '#f6ffed',
        border: '1px solid #b7eb8f',
        borderRadius: 4
      }}>
        <Text style={{ fontSize: '12px', color: '#389e0d' }}>
          💡 创建分组后，您可以在添加联系人时选择分组，或在联系人详情中修改分组归属
        </Text>
      </div>
    </Modal>
  );
};

export default CreateGroupModal;