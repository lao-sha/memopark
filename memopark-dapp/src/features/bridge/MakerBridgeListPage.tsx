import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Tag, Space, Button, Statistic, Row, Col, 
  Input, Select, Typography, message, Spin, Alert, Tooltip 
} from 'antd';
import { 
  SwapOutlined, StarFilled, ThunderboltOutlined, 
  DollarOutlined, SearchOutlined, FilterOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { usePolkadot } from '@/providers/WalletProvider';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

/**
 * 做市商桥接列表页面
 * 
 * 功能：
 * - 展示所有提供桥接服务的做市商
 * - 显示做市商关键指标（费率、成功率、平均时间、押金等）
 * - 支持搜索和筛选
 * - 排序功能（按费率、成功率、速度）
 * - 跳转到兑换页面
 */
export const MakerBridgeListPage: React.FC = () => {
  const { api } = usePolkadot();
  const navigate = useNavigate();
  
  // 状态
  const [makers, setMakers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'feeRate' | 'successRate' | 'avgTime'>('feeRate');
  const [filterEnabled, setFilterEnabled] = useState(true);
  
  /**
   * 加载做市商列表
   * 查询所有活跃的做市商，筛选出提供桥接服务的做市商
   */
  const loadMakers = async () => {
    if (!api) {
      message.error('区块链连接未就绪');
      return;
    }
    
    setLoading(true);
    try {
      // 1. 获取所有活跃做市商
      const activeMakersEntries = await api.query.marketMaker.activeMarketMakers.entries();
      
      const bridgeMakers: any[] = [];
      
      // 2. 遍历做市商，查询桥接服务配置
      for (const [key, makerOpt] of activeMakersEntries) {
        const mmId = (key.args[0] as any).toNumber();
        const maker = makerOpt.unwrap();
        
        // 3. 查询桥接服务配置
        const serviceOpt = await api.query.marketMaker.bridgeServices(mmId);
        
        if (serviceOpt.isSome) {
          const service = serviceOpt.unwrap();
          const enabled = service.enabled.toHuman();
          
          // 4. 只显示启用的服务
          if (filterEnabled && !enabled) {
            continue;
          }
          
          const totalSwaps = service.total_swaps.toNumber();
          const successCount = service.success_count.toNumber();
          const successRate = totalSwaps > 0 ? (successCount / totalSwaps) * 100 : 0;
          
          bridgeMakers.push({
            mmId,
            owner: maker.owner.toHuman(),
            name: maker.public_cid.toHuman() || `做市商 #${mmId}`,
            feeRate: service.fee_rate_bps.toNumber() / 100, // bps -> %
            maxSwapAmount: service.max_swap_amount.toNumber() / 1_000_000, // USDT
            totalSwaps,
            successCount,
            successRate,
            avgTime: service.avg_time_seconds.toNumber(), // 秒
            deposit: service.deposit.toNumber() / 1e12, // MEMO
            enabled,
          });
        }
      }
      
      // 5. 排序
      const sorted = sortMakers(bridgeMakers, sortBy);
      setMakers(sorted);
      
    } catch (error: any) {
      console.error('加载做市商列表失败:', error);
      message.error(`加载失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 排序做市商列表
   */
  const sortMakers = (list: any[], by: typeof sortBy) => {
    return [...list].sort((a, b) => {
      switch (by) {
        case 'feeRate':
          return a.feeRate - b.feeRate; // 费率从低到高
        case 'successRate':
          return b.successRate - a.successRate; // 成功率从高到低
        case 'avgTime':
          return a.avgTime - b.avgTime; // 时间从短到长
        default:
          return 0;
      }
    });
  };
  
  /**
   * 搜索过滤
   */
  const filteredMakers = makers.filter(maker => {
    if (!searchText) return true;
    const text = searchText.toLowerCase();
    return (
      maker.name.toLowerCase().includes(text) ||
      maker.mmId.toString().includes(text) ||
      maker.owner.toLowerCase().includes(text)
    );
  });
  
  /**
   * 处理排序变更
   */
  const handleSortChange = (value: typeof sortBy) => {
    setSortBy(value);
    const sorted = sortMakers(makers, value);
    setMakers(sorted);
  };
  
  /**
   * 跳转到兑换页面
   */
  const handleSwap = (mmId: number) => {
    navigate(`/bridge/maker-swap/${mmId}`);
  };
  
  // 初始加载
  useEffect(() => {
    loadMakers();
  }, [api, filterEnabled]);
  
  /**
   * 表格列定义
   */
  const columns = [
    {
      title: '做市商',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ID: {record.mmId}
          </Text>
        </Space>
      ),
    },
    {
      title: '手续费率',
      dataIndex: 'feeRate',
      key: 'feeRate',
      width: 120,
      sorter: (a: any, b: any) => a.feeRate - b.feeRate,
      render: (rate: number) => (
        <Tag color="green" style={{ fontSize: 14, padding: '4px 8px' }}>
          <DollarOutlined /> {rate.toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      width: 120,
      sorter: (a: any, b: any) => b.successRate - a.successRate,
      render: (rate: number, record: any) => (
        <Tooltip title={`${record.successCount} / ${record.totalSwaps} 笔成功`}>
          <Tag color={rate >= 95 ? 'green' : rate >= 85 ? 'orange' : 'red'}>
            <StarFilled /> {rate.toFixed(1)}%
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: '平均时间',
      dataIndex: 'avgTime',
      key: 'avgTime',
      width: 120,
      sorter: (a: any, b: any) => a.avgTime - b.avgTime,
      render: (seconds: number) => (
        <Tag color="blue">
          <ThunderboltOutlined /> {Math.floor(seconds / 60)} 分钟
        </Tag>
      ),
    },
    {
      title: '最大兑换额',
      dataIndex: 'maxSwapAmount',
      key: 'maxSwapAmount',
      width: 140,
      render: (amount: number) => (
        <Text>{amount.toLocaleString()} USDT</Text>
      ),
    },
    {
      title: '押金',
      dataIndex: 'deposit',
      key: 'deposit',
      width: 140,
      render: (amount: number) => (
        <Tooltip title="押金越高，做市商承诺越大">
          <Text type="secondary">{amount.toLocaleString()} MEMO</Text>
        </Tooltip>
      ),
    },
    {
      title: '累计交易',
      dataIndex: 'totalSwaps',
      key: 'totalSwaps',
      width: 100,
      render: (count: number) => <Text>{count} 笔</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button 
          type="primary" 
          icon={<SwapOutlined />}
          onClick={() => handleSwap(record.mmId)}
          disabled={!record.enabled}
        >
          兑换
        </Button>
      ),
    },
  ];
  
  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <Card>
        {/* 页面标题 */}
        <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 24 }}>
          <Title level={2}>
            <SwapOutlined /> 做市商桥接服务
          </Title>
          <Paragraph type="secondary">
            选择信誉良好的做市商，享受快速、安全的 MEMO → USDT (TRC20) 兑换服务。
            做市商由押金保障，超时未转账将受到惩罚。
          </Paragraph>
        </Space>
        
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic 
                title="可用做市商" 
                value={filteredMakers.length} 
                suffix="个"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic 
                title="最低费率" 
                value={filteredMakers.length > 0 ? Math.min(...filteredMakers.map(m => m.feeRate)) : 0} 
                suffix="%"
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic 
                title="平均成功率" 
                value={
                  filteredMakers.length > 0 
                    ? filteredMakers.reduce((sum, m) => sum + m.successRate, 0) / filteredMakers.length 
                    : 0
                } 
                suffix="%"
                precision={1}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic 
                title="累计交易" 
                value={filteredMakers.reduce((sum, m) => sum + m.totalSwaps, 0)} 
                suffix="笔"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>
        
        {/* 搜索和筛选工具栏 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col flex="auto">
            <Input
              placeholder="搜索做市商名称、ID 或地址..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Select
              style={{ width: 180 }}
              value={sortBy}
              onChange={handleSortChange}
              suffixIcon={<FilterOutlined />}
            >
              <Option value="feeRate">按费率排序 ⬆️</Option>
              <Option value="successRate">按成功率排序 ⬇️</Option>
              <Option value="avgTime">按速度排序 ⬆️</Option>
            </Select>
          </Col>
          <Col>
            <Button 
              icon={<SwapOutlined />}
              onClick={() => loadMakers()}
              loading={loading}
            >
              刷新
            </Button>
          </Col>
        </Row>
        
        {/* 提示信息 */}
        <Alert
          message="选择建议"
          description="建议优先选择成功率高（>95%）、平均时间短（<10分钟）的做市商。押金越高，做市商的服务承诺越可靠。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        {/* 做市商列表表格 */}
        <Spin spinning={loading} tip="加载做市商列表...">
          <Table
            columns={columns}
            dataSource={filteredMakers}
            rowKey="mmId"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个做市商`,
            }}
            scroll={{ x: 1200 }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default MakerBridgeListPage;

