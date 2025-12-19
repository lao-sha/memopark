/**
 * 紫微斗数命盘列表页面
 *
 * 功能：
 * - 显示用户的所有命盘
 * - 支持查看命盘详情和解读
 * - 支持设置命盘公开状态
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  List,
  Typography,
  Space,
  Button,
  Tag,
  Empty,
  Spin,
  message,
  Switch,
} from 'antd';
import {
  StarOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useWallet } from '../../providers/WalletProvider';
import * as ziweiService from '../../services/ziweiService';
import type { ZiweiChart } from '../../services/ziweiService';

const { Title, Text } = Typography;

/**
 * 紫微斗数命盘列表页面
 */
const ZiweiListPage: React.FC = () => {
  const { address } = useWallet();
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState<ZiweiChart[]>([]);

  /**
   * 加载用户的命盘列表
   */
  const loadCharts = useCallback(async () => {
    if (!address) {
      message.warning('请先连接钱包');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const userCharts = await ziweiService.getUserChartsWithDetails(address);
      setCharts(userCharts.sort((a, b) => b.createdAt - a.createdAt)); // 按创建时间倒序
      console.log('[ZiweiListPage] 加载命盘列表成功:', userCharts.length);
    } catch (error) {
      console.error('[ZiweiListPage] 加载命盘列表失败:', error);
      message.error('加载命盘列表失败');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  /**
   * 切换命盘公开状态
   */
  const handleToggleVisibility = useCallback(async (chartId: number, currentStatus: boolean) => {
    try {
      await ziweiService.setChartVisibility(chartId, !currentStatus);
      message.success(currentStatus ? '已设为私密' : '已设为公开');

      // 更新本地状态
      setCharts(prev => prev.map(chart =>
        chart.id === chartId ? { ...chart, isPublic: !currentStatus } : chart
      ));
    } catch (error: any) {
      console.error('[ZiweiListPage] 切换公开状态失败:', error);
      message.error(`操作失败: ${error.message || '请重试'}`);
    }
  }, []);

  /**
   * 查看命盘详情
   */
  const handleViewChart = useCallback((chartId: number) => {
    window.location.hash = `#/ziwei/interpretation/${chartId}`;
  }, []);

  /**
   * 返回占卜入口
   */
  const handleBack = useCallback(() => {
    window.location.hash = '#/divination';
  }, []);

  /**
   * 前往排盘页面
   */
  const handleCreateNew = useCallback(() => {
    window.location.hash = '#/ziwei';
  }, []);

  /**
   * 格式化日期
   */
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  /**
   * 渲染命盘卡片
   */
  const renderChartItem = (chart: ZiweiChart) => {
    const createDate = formatDate(chart.createdAt);
    const lunarDate = `${chart.lunarYear}年${chart.lunarMonth}月${chart.lunarDay}日`;

    return (
      <List.Item
        key={chart.id}
        actions={[
          <Button
            key="view"
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewChart(chart.id)}
          >
            查看解读
          </Button>,
        ]}
      >
        <Card
          size="small"
          style={{ width: '100%' }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {/* 标题行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <StarOutlined style={{ color: '#eb2f96' }} />
                <Text strong>命盘 #{chart.id}</Text>
                <Tag color={chart.isPublic ? 'green' : 'default'}>
                  {chart.isPublic ? <UnlockOutlined /> : <LockOutlined />}
                  {chart.isPublic ? '公开' : '私密'}
                </Tag>
              </Space>
              <Switch
                size="small"
                checked={chart.isPublic}
                onChange={() => handleToggleVisibility(chart.id, chart.isPublic)}
              />
            </div>

            {/* 信息行 */}
            <div>
              <Space split="|" size={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {lunarDate}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {ziweiService.SHICHEN_NAMES[chart.birthHour]}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {ziweiService.GENDER_NAMES[chart.gender]}命
                </Text>
              </Space>
            </div>

            {/* 详情行 */}
            <div>
              <Space size={4}>
                <Tag color="blue" style={{ fontSize: 11 }}>
                  {ziweiService.WU_XING_JU_NAMES[chart.wuXingJu]}
                </Tag>
                <Tag color="purple" style={{ fontSize: 11 }}>
                  {ziweiService.TIAN_GAN_NAMES[chart.yearGan]}{ziweiService.DI_ZHI_NAMES[chart.yearZhi]}年
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  创建于 {createDate}
                </Text>
              </Space>
            </div>

            {/* AI 解读状态 */}
            {chart.aiInterpretationCid && (
              <div>
                <Tag color="gold" style={{ fontSize: 11 }}>
                  <StarOutlined /> 已有 AI 解读
                </Tag>
              </div>
            )}
          </Space>
        </Card>
      </List.Item>
    );
  };

  return (
    <div style={{ padding: '16px', maxWidth: 414, margin: '0 auto', paddingBottom: 80 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
          />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              <StarOutlined style={{ color: '#eb2f96', marginRight: 8 }} />
              我的命盘
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {charts.length} 个命盘
            </Text>
          </div>
        </Space>
      </div>

      {/* 新建按钮 */}
      <Button
        type="primary"
        block
        icon={<PlusOutlined />}
        onClick={handleCreateNew}
        style={{ marginBottom: 16 }}
      >
        排列新命盘
      </Button>

      {/* 命盘列表 */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : charts.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={8}>
              <Text>暂无命盘</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                还没有创建过命盘，立即开始排盘吧！
              </Text>
            </Space>
          }
          style={{ padding: '60px 0' }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
            排列第一个命盘
          </Button>
        </Empty>
      ) : (
        <List
          dataSource={charts}
          renderItem={renderChartItem}
          split={false}
          style={{ marginTop: 16 }}
        />
      )}

      {/* 说明卡片 */}
      {charts.length > 0 && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Space direction="vertical" size={4}>
            <div>
              <Text strong style={{ fontSize: 12 }}>关于命盘公开状态：</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                • 公开命盘可被其他用户查看和学习
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                • 私密命盘仅自己可见
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                • 可随时切换公开状态
              </Text>
            </div>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default ZiweiListPage;
