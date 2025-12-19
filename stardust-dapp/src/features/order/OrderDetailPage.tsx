/**
 * 订单详情页面
 *
 * 功能：
 * - 查看订单状态和详情
 * - 查看解读内容
 * - 提交追问
 * - 提交评价
 * - 取消订单
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Divider,
  Tag,
  Steps,
  Empty,
  Spin,
  Alert,
  message,
  Form,
  Input,
  Rate,
  Modal,
  Checkbox,
  Timeline,
} from 'antd';
import {
  LeftOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  StarOutlined,
  MessageOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { usePolkadot } from '@/providers/WalletProvider';
import { signAndSendTxWithPassword } from '@/lib/polkadot-safe';
import {
  OrderStatus,
  ORDER_STATUS_NAMES,
  ORDER_STATUS_COLORS,
  DivinationType,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
} from '../../types/divination';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 订单数据类型
 */
interface OrderData {
  id: number;
  customer: string;
  provider: string;
  providerName: string;
  divinationType: DivinationType;
  resultId: number;
  packageId: number;
  packageName: string;
  amount: bigint;
  platformFee: bigint;
  status: OrderStatus;
  questionCid: string;
  interpretationCid?: string;
  isUrgent: boolean;
  createdAt: number;
  acceptedAt?: number;
  completedAt?: number;
  reviewedAt?: number;
}

/**
 * 追问记录类型
 */
interface FollowUp {
  id: number;
  questionCid: string;
  answerCid?: string;
  createdAt: number;
  answeredAt?: number;
}

/**
 * 评价数据类型
 */
interface ReviewData {
  overallRating: number;
  accuracyRating: number;
  attitudeRating: number;
  responseRating: number;
  commentCid: string;
  isAnonymous: boolean;
  replyCid?: string;
}

/**
 * 格式化金额
 */
function formatAmount(amount: bigint): string {
  return (Number(amount) / 1e12).toFixed(2);
}

/**
 * 订单详情页面
 */
const OrderDetailPage: React.FC = () => {
  const { api, currentAccount } = usePolkadot();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [order, setOrder] = useState<OrderData | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [review, setReview] = useState<ReviewData | null>(null);

  // 表单状态
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewForm] = Form.useForm();

  /**
   * 从URL获取订单ID
   */
  const orderId = React.useMemo(() => {
    const hash = window.location.hash;
    const match = hash.match(/#\/order\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }, []);

  /**
   * 加载订单详情
   */
  useEffect(() => {
    if (!api || !orderId) return;

    const loadOrderDetail = async () => {
      setLoading(true);
      try {
        // 查询订单
        const orderData = await api.query.divinationMarket.orders(orderId);
        if (orderData.isNone) {
          message.error('订单不存在');
          window.location.hash = '#/my-orders';
          return;
        }

        const data = orderData.unwrap().toJSON() as any;

        // 查询提供者名称
        const providerData = await api.query.divinationMarket.providers(data.provider);
        let providerName = '未知提供者';
        if (providerData.isSome) {
          const pData = providerData.unwrap().toJSON() as any;
          // 解码名称
          if (pData.name && typeof pData.name === 'string' && pData.name.startsWith('0x')) {
            try {
              const hex = pData.name.slice(2);
              const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
              providerName = new TextDecoder().decode(bytes).trim() || '未知提供者';
            } catch (e) {
              providerName = '未知提供者';
            }
          } else if (typeof pData.name === 'string') {
            providerName = pData.name;
          }
        }

        // 查询套餐名称
        const packageData = await api.query.divinationMarket.packages(data.provider, data.packageId);
        let packageName = '未知套餐';
        if (packageData.isSome) {
          const pkgData = packageData.unwrap().toJSON() as any;
          packageName = pkgData.name || '未知套餐';
        }

        setOrder({
          id: orderId,
          customer: data.customer,
          provider: data.provider,
          providerName,
          divinationType: data.divinationType as DivinationType,
          resultId: data.resultId || 0,
          packageId: data.packageId || 0,
          packageName,
          amount: BigInt(data.amount || 0),
          platformFee: BigInt(data.platformFee || 0),
          status: data.status as OrderStatus,
          questionCid: data.questionCid || '',
          interpretationCid: data.interpretationCid,
          isUrgent: data.isUrgent || false,
          createdAt: data.createdAt || 0,
          acceptedAt: data.acceptedAt,
          completedAt: data.completedAt,
          reviewedAt: data.reviewedAt,
        });

        // 查询追问记录
        const followUpData = await api.query.divinationMarket.followUps(orderId);
        if (followUpData.isSome) {
          const fuList = followUpData.unwrap().toJSON() as any[];
          setFollowUps(fuList.map((fu, idx) => ({
            id: idx,
            questionCid: fu.questionCid || '',
            answerCid: fu.answerCid,
            createdAt: fu.createdAt || 0,
            answeredAt: fu.answeredAt,
          })));
        }

        // 查询评价
        const reviewData = await api.query.divinationMarket.reviews(orderId);
        if (reviewData.isSome) {
          const rData = reviewData.unwrap().toJSON() as any;
          setReview({
            overallRating: rData.overallRating || 0,
            accuracyRating: rData.accuracyRating || 0,
            attitudeRating: rData.attitudeRating || 0,
            responseRating: rData.responseRating || 0,
            commentCid: rData.commentCid || '',
            isAnonymous: rData.isAnonymous || false,
            replyCid: rData.replyCid,
          });
        }
      } catch (error: any) {
        console.error('加载订单失败:', error);
        message.error('加载订单失败');
      } finally {
        setLoading(false);
      }
    };

    loadOrderDetail();
  }, [api, orderId]);

  /**
   * 提交追问
   */
  const handleSubmitFollowUp = async () => {
    if (!api || !currentAccount || !orderId || !followUpQuestion.trim()) {
      message.warning('请填写追问内容');
      return;
    }

    setSubmitting(true);
    try {
      // TODO: 上传问题到IPFS
      const questionCid = `Qm${followUpQuestion.substring(0, 44).padEnd(44, '0')}`;

      const tx = api.tx.divinationMarket.submitFollowUp(orderId, questionCid);
      await signAndSendTxWithPassword(tx, currentAccount.address);

      message.success('追问提交成功！');
      setFollowUpModalVisible(false);
      setFollowUpQuestion('');

      // 重新加载订单
      window.location.reload();
    } catch (error: any) {
      console.error('提交追问失败:', error);
      message.error(error.message || '提交追问失败');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 提交评价
   */
  const handleSubmitReview = async () => {
    if (!api || !currentAccount || !orderId) return;

    try {
      const values = await reviewForm.validateFields();
      setSubmitting(true);

      // TODO: 上传评论到IPFS
      const commentCid = `Qm${(values.comment || '').substring(0, 44).padEnd(44, '0')}`;

      const tx = api.tx.divinationMarket.submitReview(
        orderId,
        {
          overall: values.overallRating * 100,
          accuracy: values.accuracyRating * 100,
          attitude: values.attitudeRating * 100,
          response: values.responseRating * 100,
        },
        commentCid,
        values.isAnonymous || false
      );

      await signAndSendTxWithPassword(tx, currentAccount.address);

      message.success('评价提交成功！');
      setReviewModalVisible(false);

      // 重新加载订单
      window.location.reload();
    } catch (error: any) {
      console.error('提交评价失败:', error);
      message.error(error.message || '提交评价失败');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 取消订单
   */
  const handleCancelOrder = () => {
    Modal.confirm({
      title: '确认取消订单？',
      content: '取消后订单金额将退回到您的账户',
      onOk: async () => {
        if (!api || !currentAccount || !orderId) return;

        try {
          const tx = api.tx.divinationMarket.cancelOrder(orderId);
          await signAndSendTxWithPassword(tx, currentAccount.address);
          message.success('订单已取消');
          window.location.reload();
        } catch (error: any) {
          console.error('取消订单失败:', error);
          message.error(error.message || '取消订单失败');
        }
      },
    });
  };

  /**
   * 渲染订单状态
   */
  const renderOrderStatus = () => {
    if (!order) return null;

    const statusSteps = [
      { title: '已支付', status: OrderStatus.Paid },
      { title: '已接单', status: OrderStatus.Accepted },
      { title: '已完成', status: OrderStatus.Completed },
      { title: '已评价', status: OrderStatus.Reviewed },
    ];

    let current = 0;
    if (order.status === OrderStatus.Accepted) current = 1;
    else if (order.status === OrderStatus.Completed) current = 2;
    else if (order.status === OrderStatus.Reviewed) current = 3;
    else if (order.status === OrderStatus.Cancelled) current = -1;

    if (current === -1) {
      return (
        <Alert
          message="订单已取消"
          description="该订单已被取消，款项已退回"
          type="warning"
          showIcon
          icon={<CloseCircleOutlined />}
        />
      );
    }

    return (
      <Steps current={current} size="small">
        {statusSteps.map((step, idx) => (
          <Steps.Step key={idx} title={step.title} />
        ))}
      </Steps>
    );
  };

  if (!orderId) {
    return (
      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        <Card>
          <Empty description="缺少订单ID">
            <Button type="primary" onClick={() => window.location.hash = '#/my-orders'}>
              查看我的订单
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
          </div>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        <Card>
          <Empty description="订单不存在">
            <Button type="primary" onClick={() => window.location.hash = '#/my-orders'}>
              查看我的订单
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  const isCustomer = currentAccount?.address === order.customer;
  const canFollowUp = isCustomer && order.status === OrderStatus.Completed && !review;
  const canReview = isCustomer && order.status === OrderStatus.Completed && !review;
  const canCancel = isCustomer && order.status === OrderStatus.Paid;

  return (
    <div className="order-detail-page" style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {/* 顶部导航 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="link"
            icon={<LeftOutlined />}
            onClick={() => window.location.hash = '#/my-orders'}
            style={{ padding: 0 }}
          >
            返回
          </Button>
          <Divider type="vertical" />
          <Title level={4} style={{ margin: 0 }}>
            订单详情 #{order.id}
          </Title>
        </Space>
      </Card>

      {/* 订单状态 */}
      <Card style={{ marginBottom: 16 }}>
        {renderOrderStatus()}
      </Card>

      {/* 订单基本信息 */}
      <Card title="订单信息" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">订单编号</Text>
            <Text strong>#{order.id}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">服务提供者</Text>
            <Text>{order.providerName}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">占卜类型</Text>
            <Tag color="blue">
              {DIVINATION_TYPE_ICONS[order.divinationType]} {DIVINATION_TYPE_NAMES[order.divinationType]}
            </Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">服务套餐</Text>
            <Text>{order.packageName}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">订单状态</Text>
            <Tag color={ORDER_STATUS_COLORS[order.status]}>
              {ORDER_STATUS_NAMES[order.status]}
            </Tag>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">订单金额</Text>
            <Text strong style={{ fontSize: 16, color: '#f5222d' }}>
              {formatAmount(order.amount)} DUST
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">创建时间</Text>
            <Text>{new Date(order.createdAt).toLocaleString()}</Text>
          </div>
        </Space>
      </Card>

      {/* 咨询问题 */}
      <Card title="咨询问题" style={{ marginBottom: 16 }}>
        <Paragraph>
          {/* TODO: 从IPFS加载问题内容 */}
          <Text type="secondary">问题CID: {order.questionCid}</Text>
        </Paragraph>
      </Card>

      {/* 解读内容 */}
      {order.interpretationCid && (
        <Card
          title={
            <Space>
              <FileTextOutlined />
              <span>解读内容</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Paragraph>
            {/* TODO: 从IPFS加载解读内容 */}
            <Text type="secondary">解读CID: {order.interpretationCid}</Text>
          </Paragraph>
        </Card>
      )}

      {/* 追问记录 */}
      {followUps.length > 0 && (
        <Card title="追问记录" style={{ marginBottom: 16 }}>
          <Timeline>
            {followUps.map((fu) => (
              <Timeline.Item key={fu.id} color={fu.answerCid ? 'green' : 'blue'}>
                <Text strong>追问 #{fu.id + 1}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(fu.createdAt).toLocaleString()}
                </Text>
                <br />
                <Text type="secondary">问题CID: {fu.questionCid}</Text>
                {fu.answerCid && (
                  <>
                    <br />
                    <Text type="secondary">回复CID: {fu.answerCid}</Text>
                  </>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}

      {/* 评价 */}
      {review && (
        <Card title="我的评价" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">总体评分：</Text>
              <Rate disabled value={review.overallRating / 100} />
            </div>
            <div>
              <Text type="secondary">准确度：</Text>
              <Rate disabled value={review.accuracyRating / 100} />
            </div>
            <div>
              <Text type="secondary">服务态度：</Text>
              <Rate disabled value={review.attitudeRating / 100} />
            </div>
            <div>
              <Text type="secondary">响应速度：</Text>
              <Rate disabled value={review.responseRating / 100} />
            </div>
            <Divider />
            <Text type="secondary">评论CID: {review.commentCid}</Text>
            {review.replyCid && (
              <>
                <Divider />
                <Text strong>提供者回复：</Text>
                <br />
                <Text type="secondary">回复CID: {review.replyCid}</Text>
              </>
            )}
          </Space>
        </Card>
      )}

      {/* 操作按钮 */}
      <Card>
        <Space style={{ width: '100%', justifyContent: 'center' }} wrap>
          {canFollowUp && (
            <Button
              icon={<MessageOutlined />}
              onClick={() => setFollowUpModalVisible(true)}
            >
              追问
            </Button>
          )}
          {canReview && (
            <Button
              type="primary"
              icon={<StarOutlined />}
              onClick={() => setReviewModalVisible(true)}
            >
              评价
            </Button>
          )}
          {canCancel && (
            <Button danger onClick={handleCancelOrder}>
              取消订单
            </Button>
          )}
        </Space>
      </Card>

      {/* 追问弹窗 */}
      <Modal
        title="提交追问"
        open={followUpModalVisible}
        onOk={handleSubmitFollowUp}
        onCancel={() => setFollowUpModalVisible(false)}
        confirmLoading={submitting}
      >
        <Form layout="vertical">
          <Form.Item label="追问内容" required>
            <TextArea
              rows={4}
              value={followUpQuestion}
              onChange={(e) => setFollowUpQuestion(e.target.value)}
              placeholder="请输入您的追问..."
              maxLength={500}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 评价弹窗 */}
      <Modal
        title="提交评价"
        open={reviewModalVisible}
        onOk={handleSubmitReview}
        onCancel={() => setReviewModalVisible(false)}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item
            label="总体评分"
            name="overallRating"
            rules={[{ required: true, message: '请给出总体评分' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item
            label="准确度"
            name="accuracyRating"
            rules={[{ required: true, message: '请评价准确度' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item
            label="服务态度"
            name="attitudeRating"
            rules={[{ required: true, message: '请评价服务态度' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item
            label="响应速度"
            name="responseRating"
            rules={[{ required: true, message: '请评价响应速度' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item label="评价内容" name="comment">
            <TextArea rows={4} placeholder="请输入您的评价..." maxLength={500} />
          </Form.Item>
          <Form.Item name="isAnonymous" valuePropName="checked">
            <Checkbox>匿名评价</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OrderDetailPage;
