import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Space, Tag, Alert, Spin } from 'antd';
import { 
  WalletOutlined, 
  CloudUploadOutlined, 
  DatabaseOutlined, 
  NodeIndexOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useWallet } from '../../providers/WalletProvider';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;

/**
 * 存储池账户信息
 */
interface PoolAccount {
  name: string;
  palletId: string;
  address: string;
  percentage: number;
  icon: React.ReactNode;
  color: string;
  description: string;
}

/**
 * 存储池余额信息
 */
interface PoolBalance {
  address: string;
  free: string;
  reserved: string;
  total: string;
}

/**
 * 路由表条目
 */
interface RouteEntry {
  kind: number;
  account: string;
  share: number; // Permill (parts per million)
}

/**
 * 分配历史记录
 */
interface DistributionRecord {
  block: number;
  totalAmount: string;
  routeCount: number;
  timestamp?: string;
}

/**
 * 存储费用账户 Dashboard
 * 
 * 功能：
 * - 显示三个存储池账户的余额
 * - 显示累计收集、累计分配统计
 * - 显示路由表配置
 * - 显示最近的分配历史
 * - 显示下次自动分配时间
 */
const StorageTreasuryDashboard: React.FC = () => {
  const { api } = useWallet();
  
  // 存储池账户定义（从 runtime 配置读取）
  const POOL_ACCOUNTS: PoolAccount[] = [
    {
      name: 'IPFS 运营者池',
      palletId: 'py/ipfs+',
      address: '5Fm7k7ujcY5ZJbsESbEnKGrzWjNCHbjaV2mxqadxqhxrr53g',
      percentage: 50,
      icon: <CloudUploadOutlined />,
      color: '#1890ff',
      description: '去中心化存储主力服务',
    },
    {
      name: 'Arweave 运营者池',
      palletId: 'py/arwve',
      address: '5Fb3ZBybyX51w78S7gsjQPe87kaEuFR1zNGPR5e9vGQHD4Cp',
      percentage: 30,
      icon: <DatabaseOutlined />,
      color: '#52c41a',
      description: '永久存储备份服务',
    },
    {
      name: '节点运维激励池',
      palletId: 'py/nodes',
      address: '5EbnYT9ywWTYqRmm3SjUfNHKcT7hKARDpR2pfjzKHuGLXoRh',
      percentage: 20,
      icon: <NodeIndexOutlined />,
      color: '#faad14',
      description: '基础设施维护激励',
    },
  ];

  // 状态管理
  const [poolBalances, setPoolBalances] = useState<Map<string, PoolBalance>>(new Map());
  const [totalCollected, setTotalCollected] = useState<string>('0');
  const [totalDistributed, setTotalDistributed] = useState<string>('0');
  const [routeTable, setRouteTable] = useState<RouteEntry[]>([]);
  const [distributionHistory, setDistributionHistory] = useState<DistributionRecord[]>([]);
  const [lastDistributionBlock, setLastDistributionBlock] = useState<number>(0);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * 格式化余额（从 Planck 到 MEMO）
   */
  const formatBalance = (balance: string): string => {
    const value = BigInt(balance);
    const decimals = 18; // MEMO 代币精度
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;
    
    // 保留 4 位小数
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const displayFractional = fractionalStr.slice(0, 4);
    
    return `${integerPart.toLocaleString()}.${displayFractional}`;
  };

  /**
   * 加载存储池账户余额
   */
  const loadPoolBalances = async () => {
    if (!api) return;

    try {
      const balances = new Map<string, PoolBalance>();

      for (const pool of POOL_ACCOUNTS) {
        const account = await api.query.system.account(pool.address);
        const accountData = account.toJSON() as any;
        
        const free = accountData.data?.free || '0';
        const reserved = accountData.data?.reserved || '0';
        const total = (BigInt(free) + BigInt(reserved)).toString();

        balances.set(pool.address, {
          address: pool.address,
          free: free.toString(),
          reserved: reserved.toString(),
          total,
        });
      }

      setPoolBalances(balances);
    } catch (error) {
      console.error('加载池余额失败:', error);
    }
  };

  /**
   * 加载统计数据
   */
  const loadStatistics = async () => {
    if (!api) return;

    try {
      // 累计收集金额
      const collected = await api.query.storageTreasury.totalCollected();
      setTotalCollected(collected.toString());

      // 累计分配金额
      const distributed = await api.query.storageTreasury.totalDistributed();
      setTotalDistributed(distributed.toString());

      // 最后分配区块
      const lastBlock = await api.query.storageTreasury.lastDistributionBlock();
      setLastDistributionBlock(Number(lastBlock.toString()));

      // 当前区块
      const header = await api.rpc.chain.getHeader();
      setCurrentBlock(header.number.toNumber());
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  /**
   * 加载路由表配置
   */
  const loadRouteTable = async () => {
    if (!api) return;

    try {
      const routes = await api.query.storageTreasury.storageRouteTable();
      const routesData = routes.toJSON() as any[];

      if (routesData) {
        const parsedRoutes: RouteEntry[] = routesData.map((route: any) => ({
          kind: route.kind,
          account: route.account,
          share: route.share,
        }));
        setRouteTable(parsedRoutes);
      }
    } catch (error) {
      console.error('加载路由表失败:', error);
    }
  };

  /**
   * 加载分配历史
   */
  const loadDistributionHistory = async () => {
    if (!api || lastDistributionBlock === 0) return;

    try {
      const history: DistributionRecord[] = [];
      
      // 查询最近 5 次分配记录
      for (let i = 0; i < 5; i++) {
        const blockNum = lastDistributionBlock - i * 100800; // 每周一次
        if (blockNum <= 0) break;

        const record = await api.query.storageTreasury.distributionHistory(blockNum);
        if (record.isSome) {
          const recordData = record.unwrap().toJSON() as any;
          history.push({
            block: recordData.block,
            totalAmount: recordData.totalAmount,
            routeCount: recordData.routeCount,
          });
        }
      }

      setDistributionHistory(history);
    } catch (error) {
      console.error('加载分配历史失败:', error);
    }
  };

  /**
   * 初始化加载数据
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadPoolBalances(),
        loadStatistics(),
        loadRouteTable(),
      ]);
      setLoading(false);
    };

    loadData();

    // 每 12 秒刷新一次（平均 2 个区块）
    const interval = setInterval(loadData, 12000);

    return () => clearInterval(interval);
  }, [api]);

  /**
   * 加载分配历史（依赖 lastDistributionBlock）
   */
  useEffect(() => {
    if (lastDistributionBlock > 0) {
      loadDistributionHistory();
    }
  }, [lastDistributionBlock, api]);

  /**
   * 计算下次分配时间
   */
  const calculateNextDistribution = (): { blocksRemaining: number; estimatedTime: string } => {
    const distributionPeriod = 100800; // 7 天
    const blocksRemaining = lastDistributionBlock === 0 
      ? distributionPeriod 
      : distributionPeriod - ((currentBlock - lastDistributionBlock) % distributionPeriod);
    
    const secondsRemaining = blocksRemaining * 6; // 6 秒/块
    const hoursRemaining = Math.floor(secondsRemaining / 3600);
    const minutesRemaining = Math.floor((secondsRemaining % 3600) / 60);
    
    return {
      blocksRemaining,
      estimatedTime: `${hoursRemaining} 小时 ${minutesRemaining} 分钟`,
    };
  };

  /**
   * 路由表表格列定义
   */
  const routeTableColumns: ColumnsType<RouteEntry> = [
    {
      title: '类型',
      dataIndex: 'kind',
      key: 'kind',
      render: (kind: number) => {
        const kindMap: Record<number, { text: string; color: string }> = {
          0: { text: 'IPFS 池', color: 'blue' },
          1: { text: 'Arweave 池', color: 'green' },
          3: { text: '节点池', color: 'orange' },
        };
        const info = kindMap[kind] || { text: `未知 (${kind})`, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '目标账户',
      dataIndex: 'account',
      key: 'account',
      render: (account: string) => (
        <Text code copyable={{ text: account }}>
          {account.slice(0, 10)}...{account.slice(-8)}
        </Text>
      ),
    },
    {
      title: '分配比例',
      dataIndex: 'share',
      key: 'share',
      render: (share: number) => {
        // Permill: parts per million (1,000,000 = 100%)
        const percentage = (share / 10000).toFixed(2);
        return <Text strong>{percentage}%</Text>;
      },
    },
  ];

  /**
   * 分配历史表格列定义
   */
  const historyColumns: ColumnsType<DistributionRecord> = [
    {
      title: '区块号',
      dataIndex: 'block',
      key: 'block',
      render: (block: number) => <Text code>#{block.toLocaleString()}</Text>,
    },
    {
      title: '分配金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: string) => (
        <Text strong style={{ color: '#52c41a' }}>
          {formatBalance(amount)} MEMO
        </Text>
      ),
    },
    {
      title: '路由数量',
      dataIndex: 'routeCount',
      key: 'routeCount',
      render: (count: number) => <Tag color="blue">{count} 个路由</Tag>,
    },
  ];

  const nextDistribution = calculateNextDistribution();

  if (!api) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: 16 }}>连接到区块链...</Paragraph>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <WalletOutlined /> 存储费用账户监控
        </Title>
        <Paragraph type="secondary">
          实时监控 IPFS、Arweave 和节点运维三个存储池的资金状况
        </Paragraph>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="累计收集"
              value={formatBalance(totalCollected)}
              suffix="MEMO"
              precision={4}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="累计分配"
              value={formatBalance(totalDistributed)}
              suffix="MEMO"
              precision={4}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="分配率"
              value={
                totalCollected === '0'
                  ? 0
                  : ((BigInt(totalDistributed) * BigInt(10000)) / BigInt(totalCollected)).toString() / 100
              }
              suffix="%"
              precision={2}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="下次分配"
              value={nextDistribution.estimatedTime}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ fontSize: 16 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              约 {nextDistribution.blocksRemaining.toLocaleString()} 区块
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 存储池卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {POOL_ACCOUNTS.map((pool) => {
          const balance = poolBalances.get(pool.address);
          return (
            <Col xs={24} md={8} key={pool.address}>
              <Card
                loading={loading}
                title={
                  <Space>
                    <span style={{ color: pool.color, fontSize: 20 }}>
                      {pool.icon}
                    </span>
                    <span>{pool.name}</span>
                  </Space>
                }
                extra={<Tag color={pool.color}>{pool.percentage}%</Tag>}
              >
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  {pool.description}
                </Paragraph>
                
                <Statistic
                  title="当前余额"
                  value={balance ? formatBalance(balance.total) : '0'}
                  suffix="MEMO"
                  precision={4}
                  valueStyle={{ color: pool.color }}
                />
                
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    PalletId: <Text code>{pool.palletId}</Text>
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    地址: <Text code copyable={{ text: pool.address }}>
                      {pool.address.slice(0, 10)}...{pool.address.slice(-8)}
                    </Text>
                  </Text>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 路由表配置 */}
      <Card 
        title={
          <Space>
            <CheckCircleOutlined />
            <span>路由表配置</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {routeTable.length > 0 ? (
          <Table
            columns={routeTableColumns}
            dataSource={routeTable}
            pagination={false}
            rowKey="kind"
          />
        ) : (
          <Alert
            message="路由表未配置"
            description="请通过治理提案调用 storageTreasury.setStorageRouteTable 设置路由表"
            type="warning"
            showIcon
          />
        )}
      </Card>

      {/* 分配历史 */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            <span>最近分配历史</span>
          </Space>
        }
      >
        {distributionHistory.length > 0 ? (
          <Table
            columns={historyColumns}
            dataSource={distributionHistory}
            pagination={false}
            rowKey="block"
          />
        ) : (
          <Alert
            message="暂无分配历史"
            description={
              lastDistributionBlock === 0
                ? '尚未执行过自动分配，等待下次分配周期（每 100,800 区块 ≈ 7 天）'
                : '正在加载分配历史...'
            }
            type="info"
            showIcon
          />
        )}
      </Card>
    </div>
  );
};

export default StorageTreasuryDashboard;

