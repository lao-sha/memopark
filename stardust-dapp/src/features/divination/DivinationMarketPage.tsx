/**
 * 通用占卜服务市场页面
 *
 * 支持多种占卜类型的服务提供者和套餐展示：
 * - 按占卜类型筛选提供者
 * - 服务套餐展示
 * - 下单流程
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Typography,
  Tag,
  Space,
  Spin,
  Empty,
  Rate,
  Avatar,
  Badge,
  Modal,
  Input,
  message,
  Divider,
  Row,
  Col,
  Statistic,
  Tabs,
} from 'antd';
import {
  UserOutlined,
  FireOutlined,
  MessageOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  PhoneOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import {
  getDivinationServiceProviders,
  getDivinationProviderPackages,
  createDivinationMarketOrder,
} from '../../services/divinationService';
import type { ServiceProvider, ServicePackage } from '../../types/divination';
import {
  DivinationType,
  ProviderTier,
  ServiceType,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  PROVIDER_TIER_NAMES,
  PROVIDER_TIER_COLORS,
  SERVICE_TYPE_NAMES,
  SPECIALTY_NAMES,
  getSpecialties,
  getSupportedDivinationTypes,
  calculateAverageRating,
  calculateCompletionRate,
} from '../../types/divination';
import './DivinationPage.css';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

/**
 * 服务类型图标映射
 */
const SERVICE_ICONS: Record<ServiceType, React.ReactNode> = {
  [ServiceType.TextReading]: <MessageOutlined />,
  [ServiceType.VoiceReading]: <AudioOutlined />,
  [ServiceType.VideoReading]: <VideoCameraOutlined />,
  [ServiceType.LiveConsultation]: <PhoneOutlined />,
};

/**
 * 格式化价格（DUST）
 */
const formatPrice = (price: bigint): string => {
  const dust = Number(price) / 1e12;
  return dust.toFixed(2);
};

/**
 * 服务套餐卡片
 */
const PackageCard: React.FC<{
  pkg: ServicePackage;
  onSelect: () => void;
}> = ({ pkg, onSelect }) => (
  <Card size="small" className="package-card" hoverable onClick={onSelect}>
    <div className="package-header">
      <Space>
        {SERVICE_ICONS[pkg.serviceType]}
        <Text strong>{pkg.name}</Text>
      </Space>
      <Tag color="gold">{formatPrice(pkg.price)} DUST</Tag>
    </div>
    <Paragraph type="secondary" className="package-description" ellipsis={{ rows: 2 }}>
      {pkg.description}
    </Paragraph>
    <div className="package-footer">
      <Space size="small">
        <Tag>{SERVICE_TYPE_NAMES[pkg.serviceType]}</Tag>
        <Tag color="blue">{DIVINATION_TYPE_NAMES[pkg.divinationType]}</Tag>
        {pkg.followUpCount > 0 && <Tag color="cyan">{pkg.followUpCount}次追问</Tag>}
        {pkg.urgentAvailable && <Tag color="red" icon={<FireOutlined />}>加急</Tag>}
      </Space>
    </div>
  </Card>
);

/**
 * 服务提供者卡片
 */
const ProviderCard: React.FC<{
  provider: ServiceProvider;
  packages: ServicePackage[];
  selectedType: DivinationType | 'all';
  onSelectPackage: (pkg: ServicePackage) => void;
  expanded: boolean;
  onToggle: () => void;
}> = ({ provider, packages, selectedType, onSelectPackage, expanded, onToggle }) => {
  const avgRating = calculateAverageRating(provider);
  const completionRate = calculateCompletionRate(provider);
  const specialties = getSpecialties(provider.specialties);
  const supportedTypes = getSupportedDivinationTypes(provider.supportedDivinationTypes);

  // 根据类型筛选过滤套餐
  const filteredPackages = packages.filter(p => {
    if (!p.isActive) return false;
    if (selectedType !== 'all' && p.divinationType !== selectedType) return false;
    return true;
  });

  return (
    <Card className="provider-card">
      {/* 提供者信息 */}
      <div className="provider-header" onClick={onToggle}>
        <div className="provider-info">
          <Badge
            count={provider.isActive ? 0 : '休息中'}
            offset={[-5, 5]}
          >
            <Avatar
              size={48}
              icon={<UserOutlined />}
              src={provider.avatarCid ? `https://ipfs.io/ipfs/${provider.avatarCid}` : undefined}
            />
          </Badge>
          <div className="provider-details">
            <div className="provider-name-row">
              <Text strong className="provider-name">{provider.name}</Text>
              <Tag color={PROVIDER_TIER_COLORS[provider.tier]}>
                {PROVIDER_TIER_NAMES[provider.tier]}
              </Tag>
              {provider.acceptsUrgent && (
                <Tag color="red" icon={<FireOutlined />}>加急</Tag>
              )}
            </div>
            <div className="provider-stats">
              <Rate disabled value={avgRating} allowHalf style={{ fontSize: 12 }} />
              <Text type="secondary" style={{ marginLeft: 4 }}>
                {avgRating.toFixed(1)} ({provider.totalRatings}评价)
              </Text>
            </div>
          </div>
        </div>
        <div className="provider-metrics">
          <Statistic
            title="完成订单"
            value={provider.completedOrders}
            valueStyle={{ fontSize: 16 }}
          />
          <Statistic
            title="完成率"
            value={completionRate}
            suffix="%"
            valueStyle={{ fontSize: 16 }}
          />
        </div>
      </div>

      {/* 支持的占卜类型 */}
      <div className="provider-supported-types" style={{ marginTop: 8 }}>
        {supportedTypes.map((t) => (
          <Tag key={t} color="purple">
            {DIVINATION_TYPE_ICONS[t]} {DIVINATION_TYPE_NAMES[t]}
          </Tag>
        ))}
      </div>

      {/* 简介 */}
      <Paragraph type="secondary" className="provider-bio" ellipsis={{ rows: 2 }}>
        {provider.bio}
      </Paragraph>

      {/* 擅长领域 */}
      <div className="provider-specialties">
        {specialties.map((s) => (
          <Tag key={s}>{SPECIALTY_NAMES[s]}</Tag>
        ))}
      </div>

      {/* 展开的套餐列表 */}
      {expanded && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div className="packages-section">
            <Text strong>服务套餐</Text>
            {filteredPackages.length === 0 ? (
              <Empty description="该类型下暂无服务套餐" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                {filteredPackages.map((pkg) => (
                  <Col key={pkg.id} span={24}>
                    <PackageCard pkg={pkg} onSelect={() => onSelectPackage(pkg)} />
                  </Col>
                ))}
              </Row>
            )}
          </div>
        </>
      )}

      {/* 展开/收起按钮 */}
      <Button type="link" block onClick={onToggle} className="toggle-button">
        {expanded ? '收起套餐' : `查看套餐 (${filteredPackages.length})`}
      </Button>
    </Card>
  );
};

/**
 * 下单确认弹窗
 */
const OrderConfirmModal: React.FC<{
  visible: boolean;
  provider: ServiceProvider | null;
  pkg: ServicePackage | null;
  resultId: number | null;
  onConfirm: (questionCid: string, isUrgent: boolean) => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ visible, provider, pkg, resultId, onConfirm, onCancel, loading }) => {
  const [question, setQuestion] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  const handleConfirm = async () => {
    if (!question.trim()) {
      message.warning('请输入您的问题描述');
      return;
    }
    // TODO: 上传问题到 IPFS 获取 CID
    const questionCid = 'mock-cid-' + Date.now();
    onConfirm(questionCid, isUrgent);
  };

  if (!provider || !pkg) return null;

  const finalPrice = isUrgent && pkg.urgentAvailable
    ? Number(pkg.price) * (1 + pkg.urgentSurcharge / 10000)
    : Number(pkg.price);

  return (
    <Modal
      title="确认下单"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button
          key="confirm"
          type="primary"
          loading={loading}
          onClick={handleConfirm}
        >
          确认支付 {formatPrice(BigInt(Math.floor(finalPrice)))} DUST
        </Button>,
      ]}
    >
      <div className="order-confirm-content">
        <div className="order-info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text type="secondary">服务提供者</Text>
          <Text strong>{provider.name}</Text>
        </div>
        <div className="order-info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text type="secondary">服务套餐</Text>
          <Text strong>{pkg.name}</Text>
        </div>
        <div className="order-info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text type="secondary">占卜类型</Text>
          <Tag color="purple">{DIVINATION_TYPE_NAMES[pkg.divinationType]}</Tag>
        </div>
        <div className="order-info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text type="secondary">服务类型</Text>
          <Text>{SERVICE_TYPE_NAMES[pkg.serviceType]}</Text>
        </div>
        <div className="order-info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text type="secondary">包含追问</Text>
          <Text>{pkg.followUpCount} 次</Text>
        </div>

        <Divider />

        <div className="question-input">
          <Text strong>问题描述</Text>
          <Input.TextArea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="请详细描述您想占卜的问题，以便大师更好地为您解读..."
            rows={4}
            maxLength={500}
            showCount
            style={{ marginTop: 8 }}
          />
        </div>

        {pkg.urgentAvailable && provider.acceptsUrgent && (
          <div className="urgent-option" style={{ marginTop: 16 }}>
            <Space>
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
              />
              <Text>
                <FireOutlined style={{ color: '#ff4d4f' }} /> 加急服务
                (+{(pkg.urgentSurcharge / 100).toFixed(0)}%)
              </Text>
            </Space>
          </div>
        )}

        <Divider />

        <div className="order-info-row price-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">应付金额</Text>
          <Text strong style={{ color: '#faad14', fontSize: 18 }}>
            {formatPrice(BigInt(Math.floor(finalPrice)))} DUST
          </Text>
        </div>
      </div>
    </Modal>
  );
};

/**
 * 通用占卜服务市场页面
 */
const DivinationMarketPage: React.FC = () => {
  // URL 参数
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.split('?')[1] || '');
  const resultIdParam = params.get('resultId');
  const typeParam = params.get('type');

  // 状态
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [providerPackages, setProviderPackages] = useState<Map<string, ServicePackage[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState<DivinationType | 'all'>(
    typeParam ? parseInt(typeParam, 10) as DivinationType : 'all'
  );
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  // 下单状态
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
  const [ordering, setOrdering] = useState(false);

  /**
   * 加载提供者列表
   */
  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const divinationType = selectedType === 'all' ? undefined : selectedType;
      const providerList = await getDivinationServiceProviders(divinationType);
      setProviders(providerList);

      // 加载每个提供者的套餐
      const packagesMap = new Map<string, ServicePackage[]>();
      await Promise.all(
        providerList.map(async (p) => {
          const pkgs = await getDivinationProviderPackages(p.account, divinationType);
          packagesMap.set(p.account, pkgs);
        })
      );
      setProviderPackages(packagesMap);
    } catch (error) {
      console.error('加载服务市场失败:', error);
      message.error('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  /**
   * 筛选后的提供者列表
   */
  const filteredProviders = providers.filter((p) => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      p.name.toLowerCase().includes(searchLower) ||
      p.bio.toLowerCase().includes(searchLower)
    );
  });

  /**
   * 选择套餐
   */
  const handleSelectPackage = (provider: ServiceProvider, pkg: ServicePackage) => {
    if (!resultIdParam) {
      message.warning('请先起卦后再选择服务');
      // 根据套餐类型跳转到对应的起卦页面
      const typeRoute = pkg.divinationType === DivinationType.Meihua ? '#/meihua' : '#/divination';
      window.location.hash = typeRoute;
      return;
    }

    if (!provider.isActive) {
      message.warning('该提供者当前不接单');
      return;
    }

    setSelectedProvider(provider);
    setSelectedPackage(pkg);
    setOrderModalVisible(true);
  };

  /**
   * 确认下单
   */
  const handleConfirmOrder = async (questionCid: string, isUrgent: boolean) => {
    if (!selectedProvider || !selectedPackage || !resultIdParam) return;

    setOrdering(true);
    try {
      const orderId = await createDivinationMarketOrder(
        selectedProvider.account,
        selectedPackage.divinationType,
        parseInt(resultIdParam, 10),
        selectedPackage.id,
        questionCid,
        isUrgent
      );
      message.success('下单成功！');
      setOrderModalVisible(false);
      // TODO: 跳转到订单详情页
      window.location.hash = `#/divination/order/${orderId}`;
    } catch (error) {
      console.error('下单失败:', error);
      message.error('下单失败，请稍后重试');
    } finally {
      setOrdering(false);
    }
  };

  /**
   * 占卜类型标签页
   */
  const typeTabItems = [
    { key: 'all', label: '全部' },
    ...Object.values(DivinationType)
      .filter((v) => typeof v === 'number')
      .map((t) => ({
        key: String(t),
        label: `${DIVINATION_TYPE_ICONS[t as DivinationType]} ${DIVINATION_TYPE_NAMES[t as DivinationType]}`,
      })),
  ];

  return (
    <div className="divination-market-page">
      {/* 页面标题 */}
      <Card className="page-header">
        <Title level={4}>🔮 占卜服务市场</Title>
        <Text type="secondary">找到适合您的大师，获取专业解读</Text>

        {resultIdParam && (
          <Tag color="blue" style={{ marginTop: 8 }}>
            已选择占卜结果 #{resultIdParam}
          </Tag>
        )}
      </Card>

      {/* 占卜类型筛选 */}
      <div className="filter-section">
        <Tabs
          activeKey={String(selectedType)}
          onChange={(key) => setSelectedType(key === 'all' ? 'all' : parseInt(key, 10) as DivinationType)}
          items={typeTabItems}
          className="type-tabs"
        />
      </div>

      {/* 搜索栏 */}
      <Card className="search-card">
        <Search
          placeholder="搜索大师名称或简介..."
          allowClear
          enterButton={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </Card>

      {/* 提供者列表 */}
      {loading ? (
        <div className="loading-container">
          <Spin size="large" tip="加载服务市场..." />
        </div>
      ) : filteredProviders.length === 0 ? (
        <Card>
          <Empty
            description={
              searchText
                ? '没有找到匹配的大师'
                : selectedType !== 'all'
                ? `暂无${DIVINATION_TYPE_NAMES[selectedType]}服务提供者`
                : '暂无服务提供者'
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <div className="providers-list">
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.account}
              provider={provider}
              packages={providerPackages.get(provider.account) || []}
              selectedType={selectedType}
              onSelectPackage={(pkg) => handleSelectPackage(provider, pkg)}
              expanded={expandedProvider === provider.account}
              onToggle={() =>
                setExpandedProvider(
                  expandedProvider === provider.account ? null : provider.account
                )
              }
            />
          ))}
        </div>
      )}

      {/* 底部提示 */}
      {!resultIdParam && (
        <Card className="hint-card">
          <div className="hint-content">
            <ShoppingCartOutlined style={{ fontSize: 24, color: '#faad14' }} />
            <div>
              <Text strong>还没有占卜结果？</Text>
              <br />
              <Text type="secondary">先选择一种占卜方式，获取结果后再找大师解读</Text>
            </div>
            <Button type="primary" onClick={() => window.location.hash = '#/divination'}>
              去占卜
            </Button>
          </div>
        </Card>
      )}

      {/* 下单确认弹窗 */}
      <OrderConfirmModal
        visible={orderModalVisible}
        provider={selectedProvider}
        pkg={selectedPackage}
        resultId={resultIdParam ? parseInt(resultIdParam, 10) : null}
        onConfirm={handleConfirmOrder}
        onCancel={() => setOrderModalVisible(false)}
        loading={ordering}
      />
    </div>
  );
};

export default DivinationMarketPage;
