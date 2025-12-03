/**
 * 悬赏创建弹窗组件
 *
 * 允许用户基于已有的占卜结果创建悬赏问答
 */

import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Slider,
  DatePicker,
  Button,
  Space,
  Typography,
  Card,
  Tag,
  Alert,
  Divider,
  Row,
  Col,
  message,
} from 'antd';
import {
  QuestionCircleOutlined,
  FireOutlined,
  GiftOutlined,
  ClockCircleOutlined,
  UserOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import type {
  DivinationType,
  Specialty,
  RewardDistribution,
  DEFAULT_REWARD_DISTRIBUTION,
} from '../../types/divination';
import {
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  SPECIALTY_NAMES,
  formatBountyAmount,
  calculateRewards,
} from '../../types/divination';
import { createBounty } from '../../services/bountyService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

/**
 * 悬赏创建表单数据接口
 */
export interface BountyCreateFormData {
  /** 问题描述 */
  question: string;
  /** 悬赏金额（DUST） */
  amount: number;
  /** 截止时间（小时） */
  deadlineHours: number;
  /** 最少回答数 */
  minAnswers: number;
  /** 最多回答数 */
  maxAnswers: number;
  /** 指定擅长领域 */
  specialty?: Specialty;
  /** 是否仅限认证提供者 */
  certifiedOnly: boolean;
  /** 是否允许投票 */
  allowVoting: boolean;
}

/**
 * 组件Props接口
 */
export interface CreateBountyModalProps {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 占卜类型 */
  divinationType: DivinationType;
  /** 占卜结果ID */
  resultId: number;
  /** 用户账户地址 */
  userAccount: string;
  /** 关闭弹窗回调 */
  onCancel: () => void;
  /** 创建成功回调 */
  onSuccess: (bountyId: number) => void;
}

/**
 * 奖励预览组件
 */
const RewardPreview: React.FC<{
  amount: number;
  distribution: RewardDistribution;
}> = ({ amount, distribution }) => {
  const rewards = calculateRewards(BigInt(amount * 1e12), distribution);

  return (
    <Card size="small" className="reward-preview">
      <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
        <GiftOutlined style={{ color: '#faad14' }} /> 奖励分配预览
      </Title>
      <Row gutter={[8, 4]}>
        <Col span={12}>
          <Text type="secondary">🥇 第一名：</Text>
          <Text strong style={{ color: '#faad14' }}>
            {formatBountyAmount(rewards.firstPlace)} DUST
          </Text>
        </Col>
        <Col span={12}>
          <Text type="secondary">🥈 第二名：</Text>
          <Text strong style={{ color: '#1890ff' }}>
            {formatBountyAmount(rewards.secondPlace)} DUST
          </Text>
        </Col>
        <Col span={12}>
          <Text type="secondary">🥉 第三名：</Text>
          <Text strong style={{ color: '#722ed1' }}>
            {formatBountyAmount(rewards.thirdPlace)} DUST
          </Text>
        </Col>
        <Col span={12}>
          <Text type="secondary">🎁 参与奖：</Text>
          <Text strong style={{ color: '#52c41a' }}>
            {formatBountyAmount(rewards.participationPool)} DUST
          </Text>
        </Col>
      </Row>
      <Divider style={{ margin: '8px 0' }} />
      <Row>
        <Col span={24}>
          <Text type="secondary">平台手续费：</Text>
          <Text>{formatBountyAmount(rewards.platformFee)} DUST (15%)</Text>
        </Col>
      </Row>
    </Card>
  );
};

/**
 * 悬赏创建弹窗组件
 */
export const CreateBountyModal: React.FC<CreateBountyModalProps> = ({
  visible,
  divinationType,
  resultId,
  userAccount,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm<BountyCreateFormData>();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(1000);

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: BountyCreateFormData) => {
    setLoading(true);
    try {
      const bountyId = await createBounty({
        account: userAccount,
        divinationType,
        resultId,
        questionText: values.question,
        bountyAmount: BigInt(values.amount * 1e12), // 转换为最小单位
        deadlineBlocks: Math.floor((values.deadlineHours * 3600) / 6), // 转换为区块数
        minAnswers: values.minAnswers,
        maxAnswers: values.maxAnswers,
        specialty: values.specialty,
        certifiedOnly: values.certifiedOnly,
        allowVoting: values.allowVoting,
      });

      message.success('悬赏创建成功！');
      form.resetFields();
      onSuccess(bountyId);
    } catch (error) {
      console.error('创建悬赏失败:', error);
      message.error('创建悬赏失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取预设悬赏金额选项
   */
  const getAmountPresets = () => [
    { label: '100 DUST', value: 100 },
    { label: '500 DUST', value: 500 },
    { label: '1,000 DUST', value: 1000 },
    { label: '5,000 DUST', value: 5000 },
    { label: '10,000 DUST', value: 10000 },
  ];

  /**
   * 获取时间预设选项
   */
  const getTimePresets = () => [
    { label: '6小时', value: 6 },
    { label: '12小时', value: 12 },
    { label: '24小时', value: 24 },
    { label: '48小时', value: 48 },
    { label: '72小时', value: 72 },
  ];

  return (
    <Modal
      title={
        <Space>
          <QuestionCircleOutlined style={{ color: '#1890ff' }} />
          <span>发起悬赏问答</span>
          <Tag color="purple">
            {DIVINATION_TYPE_ICONS[divinationType]} {DIVINATION_TYPE_NAMES[divinationType]}
          </Tag>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={null}
      destroyOnClose
    >
      <div className="create-bounty-modal">
        {/* 悬赏说明 */}
        <Alert
          message="悬赏问答说明"
          description="悬赏问答是基于您的占卜结果，邀请专业大师提供深度解读的功能。您可以设置悬赏金额和条件，吸引更多优质回答。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* 占卜结果信息 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <Text type="secondary">占卜结果：</Text>
            <Tag color="blue">#{resultId}</Tag>
            <Text type="secondary">类型：</Text>
            <Tag color="purple">
              {DIVINATION_TYPE_ICONS[divinationType]} {DIVINATION_TYPE_NAMES[divinationType]}
            </Tag>
          </Space>
        </Card>

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            amount: 1000,
            deadlineHours: 24,
            minAnswers: 1,
            maxAnswers: 10,
            certifiedOnly: false,
            allowVoting: true,
          }}
          onFinish={handleSubmit}
        >
          {/* 问题描述 */}
          <Form.Item
            name="question"
            label={
              <Space>
                <QuestionCircleOutlined />
                <span>问题描述</span>
              </Space>
            }
            rules={[
              { required: true, message: '请输入问题描述' },
              { min: 10, message: '问题描述至少10个字符' },
              { max: 500, message: '问题描述不能超过500个字符' },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="请详细描述您想要解读的问题，例如：这个卦象对我的事业发展有什么指示？应该注意哪些方面？"
              showCount
              maxLength={500}
            />
          </Form.Item>

          {/* 悬赏金额 */}
          <Form.Item
            name="amount"
            label={
              <Space>
                <DollarOutlined />
                <span>悬赏金额</span>
              </Space>
            }
            rules={[
              { required: true, message: '请输入悬赏金额' },
              { min: 100, message: '悬赏金额不能低于100 DUST' },
            ]}
          >
            <div>
              <InputNumber
                style={{ width: '100%' }}
                min={100}
                max={1000000}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                addonAfter="DUST"
                onChange={setAmount}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">快速选择：</Text>
                <Space size="small" style={{ marginTop: 4 }}>
                  {getAmountPresets().map((preset) => (
                    <Button
                      key={preset.value}
                      size="small"
                      onClick={() => {
                        form.setFieldValue('amount', preset.value);
                        setAmount(preset.value);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </Space>
              </div>
            </div>
          </Form.Item>

          {/* 奖励分配预览 */}
          <div style={{ marginBottom: 16 }}>
            <RewardPreview amount={amount} distribution={DEFAULT_REWARD_DISTRIBUTION} />
          </div>

          {/* 截止时间 */}
          <Form.Item
            name="deadlineHours"
            label={
              <Space>
                <ClockCircleOutlined />
                <span>截止时间</span>
              </Space>
            }
            rules={[{ required: true, message: '请选择截止时间' }]}
          >
            <div>
              <Slider
                min={6}
                max={168}
                marks={{
                  6: '6小时',
                  24: '1天',
                  48: '2天',
                  72: '3天',
                  168: '7天',
                }}
                tooltip={{
                  formatter: (value) => `${value}小时`,
                }}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">快速选择：</Text>
                <Space size="small" style={{ marginTop: 4 }}>
                  {getTimePresets().map((preset) => (
                    <Button
                      key={preset.value}
                      size="small"
                      onClick={() => form.setFieldValue('deadlineHours', preset.value)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </Space>
              </div>
            </div>
          </Form.Item>

          {/* 回答数量设置 */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="minAnswers"
                label="最少回答数"
                rules={[{ required: true, message: '请设置最少回答数' }]}
              >
                <InputNumber
                  min={1}
                  max={50}
                  style={{ width: '100%' }}
                  addonAfter="个"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="maxAnswers"
                label="最多回答数"
                rules={[{ required: true, message: '请设置最多回答数' }]}
              >
                <InputNumber
                  min={1}
                  max={100}
                  style={{ width: '100%' }}
                  addonAfter="个"
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 高级设置 */}
          <Card title="高级设置" size="small" style={{ marginBottom: 16 }}>
            {/* 擅长领域 */}
            <Form.Item
              name="specialty"
              label="指定擅长领域（可选）"
              help="选择特定领域，只有擅长该领域的大师可以回答"
            >
              <Select placeholder="不限制，允许所有领域的大师回答" allowClear>
                {Object.entries(SPECIALTY_NAMES).map(([key, name]) => (
                  <Option key={key} value={parseInt(key)}>
                    {name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* 认证限制 */}
            <Form.Item name="certifiedOnly" valuePropName="checked">
              <Space>
                <Switch />
                <span>仅限认证提供者回答</span>
                <UserOutlined style={{ color: '#52c41a' }} />
              </Space>
            </Form.Item>

            {/* 投票功能 */}
            <Form.Item name="allowVoting" valuePropName="checked">
              <Space>
                <Switch />
                <span>允许社区投票</span>
                <FireOutlined style={{ color: '#ff4d4f' }} />
              </Space>
            </Form.Item>
          </Card>

          {/* 费用说明 */}
          <Alert
            message="费用说明"
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  • 悬赏金额将托管在平台，采纳答案后自动分配
                </Paragraph>
                <Paragraph style={{ marginBottom: 8 }}>
                  • 奖励分配比例：第一名60%、第二名15%、第三名5%、参与奖5%、平台手续费15%
                </Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>
                  • 如果到期无人回答，悬赏金额将全额退还
                </Paragraph>
              </div>
            }
            type="warning"
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
              >
                创建悬赏 ({formatBountyAmount(BigInt(amount * 1e12))} DUST)
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};

export default CreateBountyModal;