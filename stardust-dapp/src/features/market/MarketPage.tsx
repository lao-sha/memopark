/**
 * 玄学服务市场页面（统一入口）
 *
 * 功能：
 * - 智能双模式：浏览模式 + 下单模式
 * - 浏览模式：探索大师、对比服务（双Tab视图）
 * - 下单模式：快速筛选、完成下单（展开列表）
 * - 应用华易网风格配色
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, Button, Typography, Empty, Spin, message, Modal, Divider, Space } from 'antd';
import { ShopOutlined, HistoryOutlined, QuestionCircleOutlined, ArrowRightOutlined, UserAddOutlined } from '@ant-design/icons';
import { usePolkadot } from '@/providers/WalletProvider';

// Hooks
import { useMarketMode } from './hooks/useMarketMode';
import { useMarketData } from './hooks/useMarketData';

// View Components
import { BrowsingView } from './components/BrowsingView';
import { OrderingView } from './components/OrderingView';
import { MarketFilters } from './components/MarketFilters';
import { ProviderDetailView } from './components/ProviderDetailView';

// Types and Utils
import {
  DivinationType,
  ProviderTier,
  Specialty,
  type ServiceProvider,
  type ServicePackage,
  getSupportedDivinationTypes,
  getSpecialties,
} from '../../types/divination';

// Styles
import './MarketPage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 格式化价格
 */
const formatPrice = (price: bigint): string => {
  const dust = Number(price) / 1e12;
  return dust.toFixed(2);
};

/**
 * 玄学服务市场页面
 */
const MarketPage: React.FC = () => {
  const { api } = usePolkadot();

  // 模式检测
  const mode = useMarketMode();

  // 加载市场数据
  const { providers, packages, loading, error } = useMarketData(
    api,
    mode.divinationType
  );

  // 筛选状态
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<DivinationType | 'all'>('all');
  const [filterTier, setFilterTier] = useState<ProviderTier | 'all'>('all');
  const [filterSpecialty, setFilterSpecialty] = useState<Specialty | 'all'>('all');

  // 视图状态
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
  const [orderingProvider, setOrderingProvider] = useState<ServiceProvider | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  /**
   * 筛选后的提供者列表
   */
  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      // 搜索文本
      if (searchText && !provider.name.includes(searchText) && !provider.bio.includes(searchText)) {
        return false;
      }
      // 占卜类型筛选
      if (filterType !== 'all') {
        const types = getSupportedDivinationTypes(provider.supportedDivinationTypes);
        if (!types.includes(filterType)) {
          return false;
        }
      }
      // 等级筛选
      if (filterTier !== 'all' && provider.tier !== filterTier) {
        return false;
      }
      // 擅长领域筛选
      if (filterSpecialty !== 'all') {
        const specialties = getSpecialties(provider.specialties);
        if (!specialties.includes(filterSpecialty)) {
          return false;
        }
      }
      return true;
    });
  }, [providers, searchText, filterType, filterTier, filterSpecialty]);

  /**
   * 处理查看提供者详情（浏览模式）
   */
  const handleViewProviderDetail = useCallback((provider: ServiceProvider) => {
    setSelectedProvider(provider);
  }, []);

  /**
   * 处理选择套餐（下单模式和浏览模式）
   */
  const handleSelectPackage = useCallback(
    (provider: ServiceProvider, pkg: ServicePackage) => {
      if (!mode.resultId) {
        message.warning('请先起卦后再选择服务');
        window.location.hash = '#/divination';
        return;
      }

      if (!provider.isActive) {
        message.warning('该提供者当前不接单');
        return;
      }

      setOrderingProvider(provider);
      setSelectedPackage(pkg);
      setOrderModalVisible(true);
    },
    [mode.resultId]
  );

  /**
   * 处理返回列表（从详情页）
   */
  const handleBackToList = useCallback(() => {
    setSelectedProvider(null);
  }, []);

  /**
   * 确认下单
   */
  const handleConfirmOrder = useCallback(() => {
    if (!orderingProvider || !selectedPackage || !mode.resultId) return;

    // TODO: 实现下单逻辑
    message.success('下单功能开发中...');
    setOrderModalVisible(false);

    // 跳转到订单创建页面
    window.location.hash = `#/order/create?provider=${orderingProvider.account}&package=${selectedPackage.id}&resultId=${mode.resultId}`;
  }, [orderingProvider, selectedPackage, mode.resultId]);

  // 加载状态
  if (loading) {
    return (
      <div className="market-page">
        <div className="market-loading">
          <Spin size="large" tip="加载市场数据..." />
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="market-page">
        <Card>
          <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => window.location.reload()}>
              重新加载
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  // 浏览模式 - 提供者详情视图
  if (mode.isBrowsing && selectedProvider) {
    return (
      <div className="market-page">
        <ProviderDetailView
          provider={selectedProvider}
          packages={packages.get(selectedProvider.account) || []}
          onBack={handleBackToList}
          onSelectPackage={(pkg) => handleSelectPackage(selectedProvider, pkg)}
        />
      </div>
    );
  }

  return (
    <div className="market-page">
      {/* 顶部导航卡片 - 复刻八字页面风格 */}
      <div className="nav-card" style={{
        borderRadius: '0',
        background: '#FFFFFF',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        border: 'none',
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '414px',
        zIndex: 100,
        height: '50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px'
      }}>
        {/* 左边：我的订单 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
          onClick={() => (window.location.hash = '#/order/my')}
        >
          <HistoryOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>我的订单</div>
        </div>

        {/* 中间：服务市场 */}
        <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>服务市场</div>

        {/* 右边：使用说明 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', cursor: 'pointer' }}
          onClick={() => setShowInstructions(true)}
        >
          <QuestionCircleOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>说明</div>
        </div>
      </div>

      {/* 顶部占位 */}
      <div style={{ height: '50px' }}></div>

      {/* 输入卡片 */}
      <Card className="input-card">
        <Title level={4} className="page-title" style={{ marginBottom: 4, textAlign: 'center' }}>
          <ShopOutlined /> 玄学服务市场
        </Title>
        <Text type="secondary" className="page-subtitle" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
          {mode.isBrowsing
            ? '汇聚各派名师，为您提供专业的命理解读服务'
            : '已有占卜结果，快速找到适合您的大师'}
        </Text>

        <Divider style={{ margin: '16px 0' }} />

        {/* 操作按钮 */}
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button
            block
            type="primary"
            size="large"
            icon={<UserAddOutlined />}
            onClick={() => window.location.hash = '#/provider/register'}
            style={{
              background: '#000000',
              borderColor: '#000000',
              borderRadius: '54px',
              height: '54px',
              fontSize: '19px',
              fontWeight: '700',
              color: '#F7D3A1',
            }}
          >
            大师入驻
          </Button>
        </Space>
      </Card>

      {/* 筛选器 */}
      <MarketFilters
        searchText={searchText}
        filterType={filterType}
        filterTier={filterTier}
        filterSpecialty={filterSpecialty}
        onSearchChange={setSearchText}
        onTypeChange={setFilterType}
        onTierChange={setFilterTier}
        onSpecialtyChange={setFilterSpecialty}
        showAdvanced={true}
      />

      {/* 内容区：根据模式切换 */}
      {mode.isBrowsing ? (
        <BrowsingView
          providers={filteredProviders}
          packages={packages}
          onViewProviderDetail={handleViewProviderDetail}
        />
      ) : (
        <OrderingView
          resultId={mode.resultId!}
          divinationType={mode.divinationType}
          providers={filteredProviders}
          packages={packages}
          onSelectPackage={handleSelectPackage}
        />
      )}

      {/* 下单确认弹窗 */}
      <Modal
        title="确认下单"
        open={orderModalVisible}
        onCancel={() => setOrderModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setOrderModalVisible(false)}>
            取消
          </Button>,
          <Button key="confirm" type="primary" onClick={handleConfirmOrder}>
            确认下单
          </Button>,
        ]}
      >
        {orderingProvider && selectedPackage && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>服务提供者：</Text>
              <Text>{orderingProvider.name}</Text>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>服务套餐：</Text>
              <Text>{selectedPackage.name}</Text>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>价格：</Text>
              <Text style={{ color: '#faad14', fontSize: 18 }}>
                {formatPrice(selectedPackage.price)} DUST
              </Text>
            </div>
            <Divider />
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              点击"确认下单"后，您将跳转到订单创建页面完成支付。
            </Paragraph>
          </div>
        )}
      </Modal>

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => (window.location.hash = '#/order/my')}>
            <HistoryOutlined /> 我的订单
          </Button>
          <Button type="link" onClick={() => (window.location.hash = '#/divination')}>
            <ArrowRightOutlined /> 占卜入口
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default MarketPage;
