/**
 * 大师工作台页面
 *
 * 功能：
 * - 今日数据统计
 * - 待接订单列表
 * - 进行中订单列表
 * - 快捷操作
 * - 收益概览
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Typography,
  Row,
  Col,
  Tabs,
  Empty,
  Statistic,
  Space,
  Tag,
  Badge,
  Avatar,
  List,
  Spin,
  message,
  Modal,
  Form,
  Input,
} from 'antd';
import {
  WalletOutlined,
  BellOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  EditOutlined,
  LineChartOutlined,
  MoneyCollectOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  StarOutlined,
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
  ProviderTier,
  PROVIDER_TIER_NAMES,
  PROVIDER_TIER_COLORS,
} from '../../types/divination';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

/**
 * 统计卡片组件
 */
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  alert?: boolean;
}> = ({ title, value, icon, trend, alert }) => (
  <Card hoverable>
    <Statistic
      title={title}
      value={value}
      prefix={icon}
      suffix={trend && <Text type={trend.startsWith('+') ? 'success' : 'danger'}>{trend}</Text>}
      valueStyle={{ color: alert ? '#ff4d4f' : undefined }}
    />
  </Card>
);

/**
 * 订单卡片组件
 */
const OrderCard: React.FC<{
  order: any;
  onAccept?: (orderId: number) => void;
  onReject?: (orderId: number) => void;
  onSubmitAnswer?: (orderId: number) => void;
  onViewDetail?: (orderId: number) => void;
  loading?: boolean;
}> = ({ order, onAccept, onReject, onSubmitAnswer, onViewDetail, loading }) => {
  const getStatusTag = (status: OrderStatus) => (
    <Tag color={ORDER_STATUS_COLORS[status]}>{ORDER_STATUS_NAMES[status]}</Tag>
  );

  const formatAmount = (amount: bigint) => {
    return (Number(amount) / 1e12).toFixed(2);
  };

  return (
    <Card
      size="small"
      hoverable
      style={{ marginBottom: 12 }}
      extra={getStatusTag(order.status)}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* 订单基本信息 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Avatar icon={<UserOutlined />} size="small" />
            <Text strong>订单 #{order.id}</Text>
          </Space>
          <Text strong style={{ fontSize: 16, color: '#f5222d' }}>
            {formatAmount(order.amount)} DUST
          </Text>
        </div>

        {/* 占卜类型 */}
        <div>
          <Tag color="blue">
            {DIVINATION_TYPE_ICONS[order.divinationType]}{' '}
            {DIVINATION_TYPE_NAMES[order.divinationType]}
          </Tag>
          {order.isUrgent && <Tag color="red">加急</Tag>}
        </div>

        {/* 时间信息 */}
        <Text type="secondary" style={{ fontSize: 12 }}>
          <ClockCircleOutlined /> 创建时间：{new Date(order.createdAt).toLocaleString()}
        </Text>

        {/* 操作按钮 */}
        <Space style={{ width: '100%', marginTop: 8 }}>
          {order.status === OrderStatus.Paid && onAccept && onReject && (
            <>
              <Button
                type="primary"
                size="small"
                onClick={() => onAccept(order.id)}
                loading={loading}
                style={{ flex: 1 }}
              >
                接单
              </Button>
              <Button
                size="small"
                onClick={() => onReject(order.id)}
                loading={loading}
                style={{ flex: 1 }}
              >
                拒绝
              </Button>
            </>
          )}

          {order.status === OrderStatus.Accepted && onSubmitAnswer && (
            <Button
              type="primary"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => onSubmitAnswer(order.id)}
              loading={loading}
              block
            >
              提交解读
            </Button>
          )}

          {onViewDetail && (
            <Button size="small" type="link" onClick={() => onViewDetail(order.id)}>
              查看详情
            </Button>
          )}
        </Space>
      </Space>
    </Card>
  );
};

/**
 * 提交解读弹窗
 */
const SubmitAnswerModal: React.FC<{
  visible: boolean;
  orderId: number | null;
  onSubmit: (orderId: number, contentCid: string) => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ visible, orderId, onSubmit, onCancel, loading }) => {
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (orderId !== null) {
        onSubmit(orderId, values.contentCid);
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <Modal
      title="提交解读"
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      confirmLoading={loading}
      width={500}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="解读内容 IPFS CID"
          name="contentCid"
          rules={[{ required: true, message: '请输入解读内容的 IPFS CID' }]}
        >
          <Input placeholder="Qm..." />
        </Form.Item>

        <Form.Item label="解读内容预览" name="preview">
          <TextArea
            placeholder="在这里输入您的解读内容（实际提交时需先上传到IPFS）"
            rows={6}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

/**
 * 快捷操作区域
 */
const QuickActions: React.FC<{
  onCreatePackage: () => void;
  onEditProfile: () => void;
  onViewStats: () => void;
  onWithdraw: () => void;
}> = ({ onCreatePackage, onEditProfile, onViewStats, onWithdraw }) => (
  <Card title="快捷操作" size="small">
    <Row gutter={[8, 8]}>
      <Col span={12}>
        <Button
          block
          icon={<PlusOutlined />}
          onClick={onCreatePackage}
        >
          创建套餐
        </Button>
      </Col>
      <Col span={12}>
        <Button
          block
          icon={<EditOutlined />}
          onClick={onEditProfile}
        >
          编辑主页
        </Button>
      </Col>
      <Col span={12}>
        <Button
          block
          icon={<LineChartOutlined />}
          onClick={onViewStats}
        >
          数据分析
        </Button>
      </Col>
      <Col span={12}>
        <Button
          block
          icon={<MoneyCollectOutlined />}
          onClick={onWithdraw}
        >
          申请提现
        </Button>
      </Col>
    </Row>
  </Card>
);

/**
 * 大师工作台页面
 */
const ProviderDashboardPage: React.FC = () => {
  const { api, currentAccount } = usePolkadot();
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'ongoing' | 'completed' | 'history'>(
    'pending'
  );

  /**
   * 加载提供者信息
   */
  useEffect(() => {
    if (api && currentAccount) {
      loadProviderInfo();
      loadOrders();
    }
  }, [api, currentAccount]);

  const loadProviderInfo = async () => {
    if (!api || !currentAccount) return;

    try {
      const providerData = await api.query.divinationMarket.providers(currentAccount.address);
      if (providerData.isSome) {
        setProvider(providerData.unwrap().toJSON());
      }
    } catch (error) {
      console.error('加载提供者信息失败:', error);
    }
  };

  const loadOrders = async () => {
    if (!api || !currentAccount) return;

    setLoading(true);
    try {
      // TODO: 从链上或 Subsquid 加载订单数据
      // 这里使用模拟数据
      const mockOrders = [
        {
          id: 1,
          customer: currentAccount.address,
          provider: currentAccount.address,
          divinationType: DivinationType.Bazi,
          resultId: 123,
          packageId: 1,
          amount: BigInt(100000000000000),
          status: OrderStatus.Paid,
          isUrgent: false,
          createdAt: Date.now() - 3600000,
        },
        {
          id: 2,
          customer: currentAccount.address,
          provider: currentAccount.address,
          divinationType: DivinationType.Meihua,
          resultId: 124,
          packageId: 2,
          amount: BigInt(50000000000000),
          status: OrderStatus.Accepted,
          isUrgent: true,
          createdAt: Date.now() - 7200000,
        },
      ];
      setOrders(mockOrders);
    } catch (error) {
      console.error('加载订单失败:', error);
      message.error('加载订单失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 接受订单
   */
  const handleAcceptOrder = async (orderId: number) => {
    if (!api || !currentAccount) {
      message.error('请先连接钱包');
      return;
    }

    setLoading(true);
    try {
      const tx = api.tx.divinationMarket.acceptOrder(orderId);
      await signAndSendTxWithPassword(tx, currentAccount.address);
      message.success('接单成功！');
      loadOrders();
    } catch (error: any) {
      console.error('接单失败:', error);
      message.error(error.message || '接单失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 拒绝订单
   */
  const handleRejectOrder = async (orderId: number) => {
    if (!api || !currentAccount) {
      message.error('请先连接钱包');
      return;
    }

    setLoading(true);
    try {
      const tx = api.tx.divinationMarket.rejectOrder(orderId);
      await signAndSendTxWithPassword(tx, currentAccount.address);
      message.success('已拒绝订单');
      loadOrders();
    } catch (error: any) {
      console.error('拒绝订单失败:', error);
      message.error(error.message || '拒绝订单失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 提交解读
   */
  const handleSubmitAnswer = async (orderId: number, contentCid: string) => {
    if (!api || !currentAccount) {
      message.error('请先连接钱包');
      return;
    }

    setLoading(true);
    try {
      const tx = api.tx.divinationMarket.submitAnswer(orderId, contentCid);
      await signAndSendTxWithPassword(tx, currentAccount.address);
      message.success('解读提交成功！');
      setSubmitModalVisible(false);
      loadOrders();
    } catch (error: any) {
      console.error('提交解读失败:', error);
      message.error(error.message || '提交解读失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 筛选订单
   */
  const filterOrders = (status: OrderStatus[]) => {
    return orders.filter((order) => status.includes(order.status));
  };

  const pendingOrders = filterOrders([OrderStatus.Paid]);
  const ongoingOrders = filterOrders([OrderStatus.Accepted]);
  const completedOrders = filterOrders([OrderStatus.Completed]);
  const historyOrders = filterOrders([OrderStatus.Reviewed, OrderStatus.Cancelled]);

  // 如果未注册为提供者，显示引导
  if (!provider) {
    return (
      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        <Card>
          <Empty
            description="您还不是服务提供者"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              onClick={() => (window.location.hash = '#/provider/register')}
            >
              立即注册
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div className="provider-dashboard" style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {/* 顶部信息卡片 */}
      <Card style={{ marginBottom: 16 }}>
        <Space align="center">
          <Avatar size={64} icon={<UserOutlined />} />
          <div>
            <Title level={4} style={{ marginBottom: 4 }}>
              {provider.name}
            </Title>
            <Space size="small">
              <Tag color={PROVIDER_TIER_COLORS[provider.tier]}>
                {PROVIDER_TIER_NAMES[provider.tier]}
              </Tag>
              <Tag icon={<StarOutlined />}>{(provider.ratingSum / (provider.totalRatings || 1) / 100).toFixed(1)}</Tag>
              <Text type="secondary">完成 {provider.completedOrders} 单</Text>
            </Space>
          </div>
        </Space>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <StatCard
            title="今日收益"
            value="128.5"
            icon={<WalletOutlined />}
            trend="+15%"
          />
        </Col>
        <Col span={12}>
          <StatCard
            title="待接订单"
            value={pendingOrders.length}
            icon={<BellOutlined />}
            alert={pendingOrders.length > 0}
          />
        </Col>
        <Col span={12}>
          <StatCard
            title="进行中"
            value={ongoingOrders.length}
            icon={<SyncOutlined />}
          />
        </Col>
        <Col span={12}>
          <StatCard
            title="本月完成"
            value={45}
            icon={<CheckCircleOutlined />}
          />
        </Col>
      </Row>

      {/* 订单列表 */}
      <Card style={{ marginBottom: 16 }}>
        <Tabs activeKey={activeTab} onChange={(key: any) => setActiveTab(key)}>
          <TabPane
            tab={
              <Badge count={pendingOrders.length} offset={[10, 0]}>
                <span>待接订单</span>
              </Badge>
            }
            key="pending"
          >
            <Spin spinning={loading}>
              {pendingOrders.length === 0 ? (
                <Empty description="暂无待接订单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                pendingOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAccept={handleAcceptOrder}
                    onReject={handleRejectOrder}
                    loading={loading}
                  />
                ))
              )}
            </Spin>
          </TabPane>

          <TabPane tab="进行中" key="ongoing">
            <Spin spinning={loading}>
              {ongoingOrders.length === 0 ? (
                <Empty description="暂无进行中订单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                ongoingOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onSubmitAnswer={(id) => {
                      setSelectedOrderId(id);
                      setSubmitModalVisible(true);
                    }}
                    loading={loading}
                  />
                ))
              )}
            </Spin>
          </TabPane>

          <TabPane tab="待评价" key="completed">
            <Spin spinning={loading}>
              {completedOrders.length === 0 ? (
                <Empty description="暂无待评价订单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                completedOrders.map((order) => (
                  <OrderCard key={order.id} order={order} loading={loading} />
                ))
              )}
            </Spin>
          </TabPane>

          <TabPane tab="历史记录" key="history">
            <Spin spinning={loading}>
              {historyOrders.length === 0 ? (
                <Empty description="暂无历史记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                historyOrders.map((order) => (
                  <OrderCard key={order.id} order={order} loading={loading} />
                ))
              )}
            </Spin>
          </TabPane>
        </Tabs>
      </Card>

      {/* 快捷操作 */}
      <QuickActions
        onCreatePackage={() => message.info('跳转到套餐创建页面')}
        onEditProfile={() => message.info('跳转到资料编辑页面')}
        onViewStats={() => message.info('跳转到数据分析页面')}
        onWithdraw={() => message.info('打开提现弹窗')}
      />

      {/* 提交解读弹窗 */}
      <SubmitAnswerModal
        visible={submitModalVisible}
        orderId={selectedOrderId}
        onSubmit={handleSubmitAnswer}
        onCancel={() => setSubmitModalVisible(false)}
        loading={loading}
      />
    </div>
  );
};

export default ProviderDashboardPage;
