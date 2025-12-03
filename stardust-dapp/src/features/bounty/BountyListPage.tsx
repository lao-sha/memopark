/**
 * 悬赏问答列表页面
 *
 * 展示所有悬赏问答，支持筛选和排序
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Typography,
  Tag,
  Space,
  Spin,
  Empty,
  Tabs,
  Input,
  Row,
  Col,
  message,
  Statistic,
  Badge,
} from 'antd';
import {
  FireOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type {
  BountyQuestion,
  BountyStatistics,
  DivinationType,
  BountyStatus,
} from '../../types/divination';
import {
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  formatBountyAmount,
  formatBountyStatusTag,
  getBountyTimeRemaining,
} from '../../types/divination';
import { BountyService } from '../../services/bountyService';
import './BountyListPage.css';

const { Title, Text } = Typography;
const { Search } = Input;

/**
 * 悬赏卡片组件
 */
const BountyCard: React.FC<{
  bounty: BountyQuestion;
  currentBlock: number;
  onClick: () => void;
}> = ({ bounty, currentBlock, onClick }) => {
  const statusTag = formatBountyStatusTag(bounty.status);
  const timeRemaining = getBountyTimeRemaining(bounty.deadline, currentBlock);

  return (
    <Card
      className="bounty-card"
      hoverable
      onClick={onClick}
    >
      {/* 悬赏头部 */}
      <div className="bounty-header">
        <Space>
          <Tag color="purple">
            {DIVINATION_TYPE_ICONS[bounty.divinationType]}{' '}
            {DIVINATION_TYPE_NAMES[bounty.divinationType]}
          </Tag>
          <Tag color={statusTag.color}>
            {statusTag.icon} {statusTag.name}
          </Tag>
        </Space>
        <div className="bounty-amount">
          <TrophyOutlined style={{ color: '#faad14', marginRight: 4 }} />
          <Text strong style={{ fontSize: 18, color: '#faad14' }}>
            {formatBountyAmount(bounty.bountyAmount)}
          </Text>
          <Text type="secondary" style={{ marginLeft: 4 }}>DUST</Text>
        </div>
      </div>

      {/* 问题描述 */}
      <div className="bounty-question" style={{ margin: '12px 0' }}>
        <Text ellipsis={{ rows: 2 }}>
          {/* TODO: 从IPFS加载问题内容 */}
          问题ID: {bounty.questionCid}
        </Text>
      </div>

      {/* 悬赏信息 */}
      <div className="bounty-info">
        <Row gutter={16}>
          <Col span={12}>
            <Space size="small">
              <ClockCircleOutlined style={{ color: timeRemaining.isExpired ? '#ff4d4f' : '#1890ff' }} />
              <Text type="secondary">
                {timeRemaining.isExpired
                  ? '已过期'
                  : `剩余${timeRemaining.hours.toFixed(0)}小时`}
              </Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space size="small">
              <FireOutlined style={{ color: '#ff4d4f' }} />
              <Text type="secondary">
                {bounty.answerCount}/{bounty.maxAnswers} 回答
              </Text>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 悬赏标签 */}
      <div className="bounty-tags" style={{ marginTop: 12 }}>
        <Space size="small" wrap>
          {bounty.certifiedOnly && (
            <Tag color="green">仅限认证</Tag>
          )}
          {bounty.allowVoting && (
            <Tag color="blue">社区投票</Tag>
          )}
          {bounty.specialty !== undefined && (
            <Tag>指定领域</Tag>
          )}
        </Space>
      </div>
    </Card>
  );
};

/**
 * 悬赏问答列表页面组件
 */
export const BountyListPage: React.FC = () => {
  const [bounties, setBounties] = useState<BountyQuestion[]>([]);
  const [stats, setStats] = useState<BountyStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'settled'>('active');
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState<DivinationType | 'all'>('all');
  const [currentBlock, setCurrentBlock] = useState(0);

  /**
   * 加载悬赏列表
   */
  const loadBounties = async () => {
    setLoading(true);
    try {
      // TODO: 获取API实例
      const api = null as any;
      const service = new BountyService(api);

      // 获取当前区块号
      // const block = await api.query.system.number();
      // setCurrentBlock(block.toNumber());
      setCurrentBlock(1000000); // 临时模拟值

      // 加载统计信息
      const statistics = await service.getBountyStatistics();
      setStats(statistics);

      // 根据标签页加载不同的悬赏列表
      let bountyList: BountyQuestion[];
      if (activeTab === 'active') {
        bountyList = await service.getActiveBounties();
      } else {
        bountyList = await service.getAllBounties(0, 50);
        if (activeTab === 'settled') {
          bountyList = bountyList.filter(b => b.status === 3); // BountyStatus.Settled
        }
      }

      // 按类型筛选
      if (selectedType !== 'all') {
        bountyList = bountyList.filter(b => b.divinationType === selectedType);
      }

      setBounties(bountyList);
    } catch (error) {
      console.error('加载悬赏列表失败:', error);
      message.error('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBounties();
  }, [activeTab, selectedType]);

  /**
   * 筛选后的悬赏列表
   */
  const filteredBounties = bounties.filter((bounty) => {
    if (!searchText) return true;
    // TODO: 加载完整问题内容后进行搜索
    return bounty.questionCid.toLowerCase().includes(searchText.toLowerCase());
  });

  /**
   * 处理悬赏卡片点击
   */
  const handleBountyClick = (bountyId: number) => {
    // 跳转到悬赏详情页
    window.location.hash = `#/bounty/${bountyId}`;
  };

  /**
   * 标签页配置
   */
  const tabItems = [
    {
      key: 'active',
      label: (
        <Space>
          <FireOutlined />
          <span>活跃悬赏</span>
          {stats && (
            <Badge count={stats.activeBounties} showZero />
          )}
        </Space>
      ),
    },
    {
      key: 'all',
      label: (
        <Space>
          <span>全部悬赏</span>
          {stats && (
            <Badge count={stats.totalBounties} showZero />
          )}
        </Space>
      ),
    },
    {
      key: 'settled',
      label: (
        <Space>
          <TrophyOutlined />
          <span>已结算</span>
          {stats && (
            <Badge count={stats.settledBounties} showZero />
          )}
        </Space>
      ),
    },
  ];

  /**
   * 占卜类型筛选器
   */
  const typeFilterItems = [
    { key: 'all', label: '全部类型' },
    ...Object.entries(DIVINATION_TYPE_NAMES).map(([key, name]) => ({
      key,
      label: `${DIVINATION_TYPE_ICONS[parseInt(key) as DivinationType]} ${name}`,
    })),
  ];

  return (
    <div className="bounty-list-page">
      {/* 页面头部 */}
      <Card className="page-header">
        <div className="header-content">
          <div>
            <Title level={4} style={{ margin: 0 }}>
              🎯 悬赏问答
            </Title>
            <Text type="secondary">悬赏求解，专业解读</Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => message.info('请先选择占卜结果后发起悬赏')}
          >
            发起悬赏
          </Button>
        </div>

        {/* 统计数据 */}
        {stats && (
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={6}>
              <Statistic
                title="总悬赏数"
                value={stats.totalBounties}
                prefix={<TrophyOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="活跃悬赏"
                value={stats.activeBounties}
                prefix={<FireOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="总回答数"
                value={stats.totalAnswers}
                prefix={<FireOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="总奖金池"
                value={formatBountyAmount(stats.totalBountyAmount)}
                suffix="DUST"
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
          </Row>
        )}
      </Card>

      {/* 筛选区域 */}
      <Card className="filter-section">
        {/* 标签页 */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as any)}
          items={tabItems}
        />

        {/* 类型筛选 */}
        <div style={{ marginTop: 16 }}>
          <Space size="small" wrap>
            {typeFilterItems.map((item) => (
              <Button
                key={item.key}
                type={selectedType.toString() === item.key ? 'primary' : 'default'}
                size="small"
                onClick={() => setSelectedType(item.key === 'all' ? 'all' : parseInt(item.key) as DivinationType)}
              >
                {item.label}
              </Button>
            ))}
          </Space>
        </div>

        {/* 搜索栏 */}
        <div style={{ marginTop: 16 }}>
          <Search
            placeholder="搜索悬赏问题..."
            allowClear
            enterButton={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            suffix={
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={loadBounties}
              />
            }
          />
        </div>
      </Card>

      {/* 悬赏列表 */}
      {loading ? (
        <div className="loading-container" style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" tip="加载悬赏列表..." />
        </div>
      ) : filteredBounties.length === 0 ? (
        <Card>
          <Empty
            description={
              searchText
                ? '没有找到匹配的悬赏'
                : activeTab === 'active'
                ? '暂无活跃悬赏'
                : '暂无悬赏'
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <div className="bounties-grid">
          <Row gutter={[16, 16]}>
            {filteredBounties.map((bounty) => (
              <Col key={bounty.id} xs={24} sm={12} md={8} lg={6}>
                <BountyCard
                  bounty={bounty}
                  currentBlock={currentBlock}
                  onClick={() => handleBountyClick(bounty.id)}
                />
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
};

export default BountyListPage;