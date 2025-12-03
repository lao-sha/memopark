/**
 * 悬赏回答提交组件
 *
 * 允许大师提交对悬赏问题的解读回答
 */

import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Card,
  Tag,
  Alert,
  message,
  Divider,
} from 'antd';
import {
  EditOutlined,
  SendOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type {
  BountyQuestion,
} from '../../types/divination';
import {
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  formatBountyAmount,
  canSubmitAnswer,
  getBountyTimeRemaining,
} from '../../types/divination';
import { BountyService } from '../../services/bountyService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 回答提交表单数据接口
 */
export interface AnswerSubmitFormData {
  /** 回答内容 */
  content: string;
}

/**
 * 组件Props接口
 */
export interface SubmitAnswerModalProps {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 悬赏问题信息 */
  bounty: BountyQuestion;
  /** 用户账户地址 */
  userAccount: string;
  /** 当前区块号 */
  currentBlock: number;
  /** 关闭弹窗回调 */
  onCancel: () => void;
  /** 提交成功回调 */
  onSuccess: (answerId: number) => void;
}

/**
 * 悬赏回答提交弹窗组件
 */
export const SubmitAnswerModal: React.FC<SubmitAnswerModalProps> = ({
  visible,
  bounty,
  userAccount,
  currentBlock,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm<AnswerSubmitFormData>();
  const [loading, setLoading] = useState(false);

  // 检查是否可以提交回答
  const canSubmit = canSubmitAnswer(bounty, currentBlock);
  const timeRemaining = getBountyTimeRemaining(bounty.deadline, currentBlock);

  // 检查是否是悬赏创建者（不能回答自己的悬赏）
  const isCreator = bounty.creator === userAccount;

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: AnswerSubmitFormData) => {
    if (!canSubmit) {
      message.error('该悬赏当前不接受新回答');
      return;
    }

    if (isCreator) {
      message.error('不能回答自己发起的悬赏');
      return;
    }

    setLoading(true);
    try {
      // TODO: 获取API实例
      const api = null as any;
      const service = new BountyService(api);

      const answerId = await service.submitBountyAnswer(
        userAccount,
        bounty.id,
        values.content
      );

      message.success('回答提交成功！');
      form.resetFields();
      onSuccess(answerId);
    } catch (error) {
      console.error('提交回答失败:', error);
      message.error('提交回答失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取回答要求文本
   */
  const getAnswerRequirements = () => {
    const requirements = [];

    if (bounty.specialty !== undefined) {
      requirements.push(`需要擅长领域匹配`);
    }

    if (bounty.certifiedOnly) {
      requirements.push(`仅限认证提供者`);
    }

    return requirements;
  };

  return (
    <Modal
      title={
        <Space>
          <EditOutlined style={{ color: '#1890ff' }} />
          <span>提交解读回答</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={null}
      destroyOnClose
    >
      <div className="submit-answer-modal">
        {/* 悬赏信息卡片 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Space>
              <Tag color="purple">
                {DIVINATION_TYPE_ICONS[bounty.divinationType]}{' '}
                {DIVINATION_TYPE_NAMES[bounty.divinationType]}
              </Tag>
              <Tag color="gold">
                <span style={{ fontSize: 16, fontWeight: 'bold' }}>
                  {formatBountyAmount(bounty.bountyAmount)} DUST
                </span>
              </Tag>
            </Space>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div>
            <Text type="secondary">问题描述：</Text>
            <Paragraph ellipsis={{ rows: 3, expandable: true }}>
              {/* TODO: 从IPFS加载问题内容 */}
              {bounty.questionCid}
            </Paragraph>
          </div>

          <div style={{ marginTop: 8 }}>
            <Space split={<Divider type="vertical" />}>
              <Text type="secondary">
                <ClockCircleOutlined /> 剩余时间：{timeRemaining.hours.toFixed(1)}小时
              </Text>
              <Text type="secondary">
                已有回答：{bounty.answerCount}/{bounty.maxAnswers}
              </Text>
            </Space>
          </div>

          {getAnswerRequirements().length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">回答要求：</Text>
              {getAnswerRequirements().map((req, index) => (
                <Tag key={index} color="blue">
                  {req}
                </Tag>
              ))}
            </div>
          )}
        </Card>

        {/* 状态提示 */}
        {!canSubmit && (
          <Alert
            message="无法提交回答"
            description={
              timeRemaining.isExpired
                ? '该悬赏已过期'
                : bounty.answerCount >= bounty.maxAnswers
                ? '该悬赏回答数已达上限'
                : '该悬赏当前不接受新回答'
            }
            type="error"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        {isCreator && (
          <Alert
            message="提示"
            description="您是该悬赏的创建者，不能回答自己的悬赏"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 奖励提示 */}
        {canSubmit && !isCreator && (
          <Alert
            message="奖励说明"
            description={
              <div>
                <Paragraph style={{ marginBottom: 4 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />{' '}
                  <strong>第一名（60%）：</strong>
                  {formatBountyAmount(bounty.bountyAmount * BigInt(60) / BigInt(100))} DUST
                </Paragraph>
                <Paragraph style={{ marginBottom: 4 }}>
                  <strong>第二名（15%）：</strong>
                  {formatBountyAmount(bounty.bountyAmount * BigInt(15) / BigInt(100))} DUST
                </Paragraph>
                <Paragraph style={{ marginBottom: 4 }}>
                  <strong>第三名（5%）：</strong>
                  {formatBountyAmount(bounty.bountyAmount * BigInt(5) / BigInt(100))} DUST
                </Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>
                  其他参与者将平分 <strong>5%</strong> 的参与奖池
                </Paragraph>
              </div>
            }
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 回答表单 */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={!canSubmit || isCreator}
        >
          <Form.Item
            name="content"
            label={
              <Space>
                <EditOutlined />
                <span>解读内容</span>
              </Space>
            }
            rules={[
              { required: true, message: '请输入解读内容' },
              { min: 50, message: '解读内容至少50个字符' },
              { max: 2000, message: '解读内容不能超过2000个字符' },
            ]}
            help="请提供详细的专业解读，包括卦象分析、吉凶判断、具体建议等"
          >
            <TextArea
              rows={10}
              placeholder="请输入您的专业解读内容，包括：&#10;1. 卦象分析与解读&#10;2. 吉凶判断与趋势预测&#10;3. 具体的行动建议&#10;4. 需要注意的事项&#10;&#10;您的专业解读将帮助提问者更好地理解占卜结果。"
              showCount
              maxLength={2000}
            />
          </Form.Item>

          {/* 提交规则提示 */}
          <Alert
            message="提交规则"
            description={
              <div>
                <Paragraph style={{ marginBottom: 4 }}>
                  • 提交后无法修改，请确保内容准确专业
                </Paragraph>
                <Paragraph style={{ marginBottom: 4 }}>
                  • 内容将公开展示，请注意措辞和专业性
                </Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>
                  • 创建者将根据质量选择前三名获奖回答
                </Paragraph>
              </div>
            }
            type="info"
            style={{ marginBottom: 16 }}
          />

          {/* 操作按钮 */}
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={onCancel}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                icon={<SendOutlined />}
                disabled={!canSubmit || isCreator}
              >
                提交回答
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};

export default SubmitAnswerModal;