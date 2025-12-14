/**
 * 我的八字列表页面
 *
 * 功能：
 * - 显示用户保存的所有八字记录
 * - 点击进入详情页
 * - 显示基本信息（出生日期、性别、四柱）
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  List,
  Button,
  Typography,
  Space,
  Tag,
  Empty,
  Spin,
  message,
  Row,
  Col,
} from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  EyeOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { getUserBaziChartsWithDetails, type OnChainBaziChart } from '../../services/baziChainService';
import { useWalletStore } from '../../stores/walletStore';
import { GENDER_NAMES, Gender } from '../../types/bazi';
import './BaziPage.css';

const { Title, Text } = Typography;

/**
 * 八字列表页面组件
 */
const BaziListPage: React.FC = () => {
  const [charts, setCharts] = useState<OnChainBaziChart[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedAccount, isConnected } = useWalletStore();

  /**
   * 加载用户的八字列表
   */
  const loadBaziCharts = async () => {
    if (!selectedAccount?.address) {
      message.warning('请先连接钱包');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const userCharts = await getUserBaziChartsWithDetails(selectedAccount.address);
      setCharts(userCharts);
    } catch (error) {
      console.error('加载八字列表失败:', error);
      message.error('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaziCharts();
  }, [selectedAccount?.address]);

  /**
   * 前往详情页
   */
  const handleViewDetail = (chartId: number) => {
    window.location.hash = `#/bazi/${chartId}`;
  };

  /**
   * 前往排盘页面
   */
  const handleCreateNew = () => {
    window.location.hash = '#/bazi';
  };

  /**
   * 格式化日期显示
   */
  const formatDate = (year: number, month: number, day: number, hour: number) => {
    return `${year}年${month}月${day}日 ${hour}时`;
  };

  /**
   * 渲染列表项
   */
  const renderChartItem = (chart: OnChainBaziChart) => {
    return (
      <List.Item
        key={chart.id}
        actions={[
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(chart.id)}
          >
            查看详情
          </Button>,
        ]}
      >
        <List.Item.Meta
          avatar={
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 20,
                fontWeight: 'bold',
              }}
            >
              {chart.id}
            </div>
          }
          title={
            <Space>
              <CalendarOutlined />
              {formatDate(chart.birthYear, chart.birthMonth, chart.birthDay, chart.birthHour)}
              <Tag color={chart.gender === Gender.Male ? 'blue' : 'pink'}>
                <UserOutlined /> {GENDER_NAMES[chart.gender as Gender]}
              </Tag>
            </Space>
          }
          description={
            <Space direction="vertical" size="small">
              {chart.creator && (
                <div>
                  <Text type="secondary">创建者：</Text>
                  <Text code>{chart.creator.slice(0, 6)}...{chart.creator.slice(-4)}</Text>
                </div>
              )}
              {chart.dataCid && (
                <div>
                  <Text type="secondary">数据CID：</Text>
                  <Text code style={{ fontSize: 12 }}>
                    {chart.dataCid.slice(0, 10)}...{chart.dataCid.slice(-6)}
                  </Text>
                </div>
              )}
            </Space>
          }
        />
      </List.Item>
    );
  };

  if (loading) {
    return (
      <div className="bazi-page">
        <Card>
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" tip="加载八字记录..." />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="bazi-page">
      {/* 页面标题 */}
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  <CalendarOutlined /> 我的八字命盘
                </Title>
                <Text type="secondary">共 {charts.length} 个命盘</Text>
              </Col>
              <Col>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateNew}
                  >
                    新建排盘
                  </Button>
                  <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => window.location.hash = '#/divination'}
                  >
                    返回
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>

          {/* 八字列表 */}
          {charts.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="还没有保存的八字记录"
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
                立即排盘
              </Button>
            </Empty>
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={charts}
              renderItem={renderChartItem}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          )}
        </Space>
      </Card>
    </div>
  );
};

export default BaziListPage;
