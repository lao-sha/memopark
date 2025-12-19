/**
 * 我的订单列表页面
 *
 * 功能：
 * - 查看所有订单
 * - 按状态筛选订单
 * - 跳转到订单详情
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Tabs,
  Empty,
  Spin,
  message,
  Badge,
} from 'antd';
import {
  ShopOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  StarOutlined,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { usePolkadot } from '@/providers/WalletProvider';
import {
  OrderStatus,
  ORDER_STATUS_NAMES,
  ORDER_STATUS_COLORS,
  DivinationType,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
} from '../../types/divination';

const { Title, Text } = Typography;

/**
 * 订单数据类型
 */
interface OrderData {
  id: number;
  customer: string;
  provider: string;
  providerName: string;
  divinationType: DivinationType;
  packageName: string;
  amount: bigint;
  status: OrderStatus;
  isUrgent: boolean;
  createdAt: number;
}

/**
 * 格式化金额
 */
function formatAmount(amount: bigint): string {
  return (Number(amount) / 1e12).toFixed(2);
}

/**
 * 订单卡片组件
 */
const OrderCard: React.FC<{
  order: OrderData;
  onClick: (orderId: number) => void;
}> = ({ order, onClick }) => (
  <Card
    hoverable
    style={{ marginBottom: 12 }}
    onClick={() => onClick(order.id)}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {/* 订单编号和状态 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong>订单 #{order.id}</Text>
            <Tag color={ORDER_STATUS_COLORS[order.status]}>
              {ORDER_STATUS_NAMES[order.status]}
            </Tag>
            {order.isUrgent && (
              <Tag color="red">加急</Tag>
            )}
          </div>

          {/* 提供者信息 */}
          <div>
            <UserOutlined style={{ marginRight: 4 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {order.providerName}
            </Text>
          </div>

          {/* 占卜类型和套餐 */}
          <div>
            <Tag color="blue" style={{ marginBottom: 4 }}>
              {DIVINATION_TYPE_ICONS[order.divinationType]} {DIVINATION_TYPE_NAMES[order.divinationType]}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {order.packageName}
            </Text>
          </div>

          {/* 创建时间 */}
          <Text type="secondary" style={{ fontSize: 11 }}>
            <ClockCircleOutlined /> {new Date(order.createdAt).toLocaleString()}
          </Text>
        </Space>
      </div>

      {/* 金额 */}
      <div style={{ textAlign: 'right', marginLeft: 16 }}>
        <Text strong style={{ fontSize: 16, color: '#f5222d' }}>
          {formatAmount(order.amount)}
        </Text>
        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
          DUST
        </Text>
      </div>
    </div>
  </Card>
);

/**
 * 我的订单列表页面
 */
const MyOrdersPage: React.FC = () => {
  const { api, currentAccount } = usePolkadot();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'ongoing' | 'completed'>('all');

  /**
   * 加载订单列表
   */
  useEffect(() => {
    if (!api || !currentAccount) return;

    const loadOrders = async () => {
      setLoading(true);
      try {
        // 查询所有订单
        const entries = await api.query.divinationMarket.orders.entries();

        const orderList: OrderData[] = [];

        for (const [key, value] of entries) {
          const orderData = value.toJSON() as any;
          if (!orderData) continue;

          // 只显示当前用户的订单（作为客户或提供者）
          if (orderData.customer !== currentAccount.address && orderData.provider !== currentAccount.address) {
            continue;
          }

          // 从 StorageKey 提取订单ID
          const orderId = key.args[0].toNumber();

          // 查询提供者名称
          let providerName = '未知提供者';
          try {
            const providerData = await api.query.divinationMarket.providers(orderData.provider);
            if (providerData.isSome) {
              const pData = providerData.unwrap().toJSON() as any;
              if (pData.name && typeof pData.name === 'string' && pData.name.startsWith('0x')) {
                const hex = pData.name.slice(2);
                const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
                providerName = new TextDecoder().decode(bytes).trim() || '未知提供者';
              } else if (typeof pData.name === 'string') {
                providerName = pData.name;
              }
            }
          } catch (e) {
            console.error('查询提供者失败:', e);
          }

          // 查询套餐名称
          let packageName = '未知套餐';
          try {
            const packageData = await api.query.divinationMarket.packages(orderData.provider, orderData.packageId);
            if (packageData.isSome) {
              const pkgData = packageData.unwrap().toJSON() as any;
              packageName = pkgData.name || '未知套餐';
            }
          } catch (e) {
            console.error('查询套餐失败:', e);
          }

          orderList.push({
            id: orderId,
            customer: orderData.customer,
            provider: orderData.provider,
            providerName,
            divinationType: orderData.divinationType as DivinationType,
            packageName,
            amount: BigInt(orderData.amount || 0),
            status: orderData.status as OrderStatus,
            isUrgent: orderData.isUrgent || false,
            createdAt: orderData.createdAt || 0,
          });
        }

        // 按创建时间倒序排列
        orderList.sort((a, b) => b.createdAt - a.createdAt);

        setOrders(orderList);
        console.log(`已加载 ${orderList.length} 个订单`);
      } catch (error: any) {
        console.error('加载订单失败:', error);
        message.error('加载订单失败');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [api, currentAccount]);

  /**
   * 筛选订单
   */
  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return orders;

    if (activeTab === 'pending') {
      return orders.filter((o) => o.status === OrderStatus.Paid);
    }

    if (activeTab === 'ongoing') {
      return orders.filter((o) => o.status === OrderStatus.Accepted);
    }

    if (activeTab === 'completed') {
      return orders.filter((o) =>
        o.status === OrderStatus.Completed || o.status === OrderStatus.Reviewed
      );
    }

    return orders;
  }, [orders, activeTab]);

  /**
   * 跳转到订单详情
   */
  const handleViewOrder = (orderId: number) => {
    window.location.hash = `#/order/${orderId}`;
  };

  /**
   * 渲染订单列表
   */
  const renderOrderList = () => {
    if (loading) {
      return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>;
    }

    if (filteredOrders.length === 0) {
      return (
        <Empty
          description={activeTab === 'all' ? '暂无订单' : '暂无相关订单'}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => window.location.hash = '#/market'}>
            去市场看看
          </Button>
        </Empty>
      );
    }

    return (
      <div>
        {filteredOrders.map((order) => (
          <OrderCard key={order.id} order={order} onClick={handleViewOrder} />
        ))}
      </div>
    );
  };

  /**
   * 计算各状态订单数量
   */
  const orderCounts = useMemo(() => {
    return {
      pending: orders.filter((o) => o.status === OrderStatus.Paid).length,
      ongoing: orders.filter((o) => o.status === OrderStatus.Accepted).length,
      completed: orders.filter((o) =>
        o.status === OrderStatus.Completed || o.status === OrderStatus.Reviewed
      ).length,
    };
  }, [orders]);

  return (
    <div className="my-orders-page" style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {/* 页面标题 */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>
          <ShopOutlined /> 我的订单
        </Title>
      </Card>

      {/* 标签页 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as any)}
          items={[
            {
              key: 'all',
              label: (
                <span>
                  <FileTextOutlined /> 全部
                </span>
              ),
              children: renderOrderList(),
            },
            {
              key: 'pending',
              label: (
                <Badge count={orderCounts.pending} offset={[10, 0]}>
                  <span>
                    <ClockCircleOutlined /> 待接单
                  </span>
                </Badge>
              ),
              children: renderOrderList(),
            },
            {
              key: 'ongoing',
              label: (
                <Badge count={orderCounts.ongoing} offset={[10, 0]}>
                  <span>
                    <FileTextOutlined /> 进行中
                  </span>
                </Badge>
              ),
              children: renderOrderList(),
            },
            {
              key: 'completed',
              label: (
                <span>
                  <CheckCircleOutlined /> 已完成
                </span>
              ),
              children: renderOrderList(),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default MyOrdersPage;
