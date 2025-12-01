/**
 * 我的卦象列表页面
 *
 * 展示用户的所有卦象记录，支持：
 * - 按状态筛选（有效/归档）
 * - 按时间排序
 * - 快速查看卦象详情
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  List,
  Button,
  Typography,
  Tag,
  Space,
  Spin,
  Empty,
  Segmented,
  message,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  NumberOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useWallet } from '../../hooks/useWallet';
import { getUserHexagrams, getHexagram } from '../../services/meihuaService';
import type { Hexagram } from '../../types/meihua';
import {
  DivinationMethod,
  HexagramStatus,
  TRIGRAM_SYMBOLS,
  getHexagramName,
  formatLunarHour,
} from '../../types/meihua';
import './MeihuaPage.css';

const { Title, Text } = Typography;

/**
 * 起卦方式图标
 */
const METHOD_ICONS: Record<DivinationMethod, React.ReactNode> = {
  [DivinationMethod.Time]: <ClockCircleOutlined />,
  [DivinationMethod.Number]: <NumberOutlined />,
  [DivinationMethod.Text]: <FileTextOutlined />,
  [DivinationMethod.Random]: <ThunderboltOutlined />,
};

/**
 * 起卦方式名称
 */
const METHOD_NAMES: Record<DivinationMethod, string> = {
  [DivinationMethod.Time]: '时间起卦',
  [DivinationMethod.Number]: '数字起卦',
  [DivinationMethod.Text]: '文字起卦',
  [DivinationMethod.Random]: '随机起卦',
};

/**
 * 筛选选项
 */
type FilterType = 'all' | 'active' | 'archived';

/**
 * 卦象列表项组件
 */
const HexagramListItem: React.FC<{
  hexagram: Hexagram;
  onClick: () => void;
}> = ({ hexagram, onClick }) => {
  const hexagramName = getHexagramName(hexagram.upperTrigram, hexagram.lowerTrigram);
  const symbol = `${TRIGRAM_SYMBOLS[hexagram.upperTrigram]}${TRIGRAM_SYMBOLS[hexagram.lowerTrigram]}`;
  const dateStr = new Date(hexagram.divinationTime).toLocaleDateString('zh-CN');
  const lunarStr = `农历${hexagram.lunarMonth}月${hexagram.lunarDay}日 ${formatLunarHour(hexagram.lunarHour)}`;

  return (
    <List.Item
      className="hexagram-list-item"
      onClick={onClick}
      actions={[
        <Button
          key="view"
          type="link"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          查看
        </Button>,
      ]}
    >
      <List.Item.Meta
        avatar={
          <div className="hexagram-avatar">
            <span className="hexagram-symbol">{symbol}</span>
          </div>
        }
        title={
          <div className="hexagram-item-title">
            <span className="hexagram-name">{hexagramName}</span>
            {hexagram.status === HexagramStatus.Archived && (
              <Tag color="default">已归档</Tag>
            )}
          </div>
        }
        description={
          <Space size="small" wrap>
            <span>
              {METHOD_ICONS[hexagram.method]}
              <Text type="secondary" style={{ marginLeft: 4 }}>
                {METHOD_NAMES[hexagram.method]}
              </Text>
            </span>
            <span>
              <CalendarOutlined style={{ marginRight: 4 }} />
              <Text type="secondary">{dateStr}</Text>
            </span>
            <Text type="secondary">{lunarStr}</Text>
          </Space>
        }
      />
    </List.Item>
  );
};

/**
 * 我的卦象列表页面
 */
const HexagramListPage: React.FC = () => {
  const { address } = useWallet();
  const [hexagrams, setHexagrams] = useState<Hexagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  /**
   * 加载用户的卦象列表
   */
  const loadHexagrams = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 获取用户的卦象 ID 列表
      const hexagramIds = await getUserHexagrams(address);

      // 并行加载所有卦象详情
      const hexagramPromises = hexagramIds.map((id) => getHexagram(id));
      const results = await Promise.all(hexagramPromises);

      // 过滤掉 null 值并按时间倒序排列
      const validHexagrams = results
        .filter((h): h is Hexagram => h !== null)
        .sort((a, b) => b.divinationTime - a.divinationTime);

      setHexagrams(validHexagrams);
    } catch (error) {
      console.error('加载卦象列表失败:', error);
      message.error('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadHexagrams();
  }, [loadHexagrams]);

  /**
   * 筛选后的卦象列表
   */
  const filteredHexagrams = hexagrams.filter((h) => {
    if (filter === 'all') return true;
    if (filter === 'active') return h.status === HexagramStatus.Active;
    if (filter === 'archived') return h.status === HexagramStatus.Archived;
    return true;
  });

  /**
   * 统计数据
   */
  const stats = {
    total: hexagrams.length,
    active: hexagrams.filter((h) => h.status === HexagramStatus.Active).length,
    archived: hexagrams.filter((h) => h.status === HexagramStatus.Archived).length,
  };

  /**
   * 查看卦象详情
   */
  const handleViewHexagram = (hexagramId: number) => {
    window.location.hash = `#/meihua/hexagram/${hexagramId}`;
  };

  /**
   * 去起卦
   */
  const handleNewDivination = () => {
    window.location.hash = '#/meihua';
  };

  if (!address) {
    return (
      <div className="meihua-page">
        <Card>
          <Empty
            description="请先连接钱包"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={() => window.location.hash = '#/wallet'}>
              连接钱包
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div className="meihua-page">
      <Card className="list-header-card">
        <div className="list-header">
          <Title level={4}>我的卦象</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleNewDivination}
          >
            起卦
          </Button>
        </div>

        {/* 统计信息 */}
        <div className="stats-row">
          <Space size="large">
            <span>
              <Text type="secondary">总计：</Text>
              <Text strong>{stats.total}</Text>
            </span>
            <span>
              <Text type="secondary">有效：</Text>
              <Text strong style={{ color: '#52c41a' }}>{stats.active}</Text>
            </span>
            <span>
              <Text type="secondary">归档：</Text>
              <Text strong>{stats.archived}</Text>
            </span>
          </Space>
        </div>

        {/* 筛选器 */}
        <div className="filter-row">
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as FilterType)}
            options={[
              { label: '全部', value: 'all' },
              { label: '有效', value: 'active' },
              { label: '已归档', value: 'archived' },
            ]}
          />
        </div>
      </Card>

      {/* 卦象列表 */}
      <Card className="hexagram-list-card">
        {loading ? (
          <div className="loading-container">
            <Spin tip="加载中..." />
          </div>
        ) : filteredHexagrams.length === 0 ? (
          <Empty
            description={
              filter === 'all'
                ? '还没有卦象记录，去起一卦吧'
                : `没有${filter === 'active' ? '有效' : '归档'}的卦象`
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            {filter === 'all' && (
              <Button type="primary" onClick={handleNewDivination}>
                立即起卦
              </Button>
            )}
          </Empty>
        ) : (
          <List
            dataSource={filteredHexagrams}
            renderItem={(hexagram) => (
              <HexagramListItem
                key={hexagram.id}
                hexagram={hexagram}
                onClick={() => handleViewHexagram(hexagram.id)}
              />
            )}
          />
        )}
      </Card>

      {/* 底部链接 */}
      <div className="bottom-links">
        <Space direction="vertical" align="center" style={{ width: '100%' }}>
          <Button type="link" onClick={() => navigate('/meihua/market')}>
            浏览占卜服务市场 →
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default HexagramListPage;
