/**
 * 占卜服务市场页面
 *
 * 功能：
 * - 展示服务提供者列表
 * - 按占卜类型、等级、擅长领域筛选
 * - 查看服务套餐和下单
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Divider,
  Tag,
  Input,
  Select,
  Rate,
  Avatar,
  List,
  Badge,
  Tabs,
  Empty,
  Spin,
} from 'antd';
import {
  ShopOutlined,
  SearchOutlined,
  FilterOutlined,
  StarOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  FireOutlined,
  TeamOutlined,
} from '@ant-design/icons';

import {
  DivinationType,
  ProviderTier,
  Specialty,
  ServiceType,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  PROVIDER_TIER_NAMES,
  PROVIDER_TIER_COLORS,
  SPECIALTY_NAMES,
  SERVICE_TYPE_NAMES,
  type ServiceProvider,
  type ServicePackage,
  calculateAverageRating,
  calculateCompletionRate,
  getSpecialties,
  getSupportedDivinationTypes,
} from '../../types/divination';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

/**
 * 模拟服务提供者数据
 */
const MOCK_PROVIDERS: ServiceProvider[] = [
  {
    account: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    name: '玄真子',
    bio: '从事命理研究二十余年，擅长八字、紫微斗数，为您指点迷津',
    avatarCid: undefined,
    tier: ProviderTier.Master,
    isActive: true,
    deposit: BigInt(100000000000000),
    registeredAt: 1000000,
    totalOrders: 528,
    completedOrders: 520,
    cancelledOrders: 3,
    totalRatings: 450,
    ratingSum: 2200,
    totalEarnings: BigInt(5000000000000000),
    specialties: 0b1111, // 事业、感情、财运、健康
    supportedDivinationTypes: 0b11110, // 八字、六爻、奇门、紫微
    acceptsUrgent: true,
    lastActiveAt: 2000000,
  },
  {
    account: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
    name: '易简居士',
    bio: '专注梅花易数与六爻预测，解读准确，言简意赅',
    avatarCid: undefined,
    tier: ProviderTier.Expert,
    isActive: true,
    deposit: BigInt(50000000000000),
    registeredAt: 1100000,
    totalOrders: 215,
    completedOrders: 210,
    cancelledOrders: 2,
    totalRatings: 180,
    ratingSum: 850,
    totalEarnings: BigInt(2000000000000000),
    specialties: 0b110001, // 事业、寻人寻物
    supportedDivinationTypes: 0b101, // 梅花、六爻
    acceptsUrgent: true,
    lastActiveAt: 2000100,
  },
  {
    account: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y',
    name: '紫云道长',
    bio: '道家传承，精通奇门遁甲、大六壬，择日选时有独到见解',
    avatarCid: undefined,
    tier: ProviderTier.Senior,
    isActive: true,
    deposit: BigInt(30000000000000),
    registeredAt: 1200000,
    totalOrders: 85,
    completedOrders: 82,
    cancelledOrders: 1,
    totalRatings: 70,
    ratingSum: 320,
    totalEarnings: BigInt(800000000000000),
    specialties: 0b1100000011, // 事业、感情、风水、择日
    supportedDivinationTypes: 0b101000, // 奇门、大六壬
    acceptsUrgent: false,
    lastActiveAt: 1999000,
  },
  {
    account: '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy',
    name: '小六壬新手',
    bio: '刚入门小六壬，虚心学习中，收费优惠',
    avatarCid: undefined,
    tier: ProviderTier.Novice,
    isActive: true,
    deposit: BigInt(10000000000000),
    registeredAt: 1900000,
    totalOrders: 5,
    completedOrders: 5,
    cancelledOrders: 0,
    totalRatings: 4,
    ratingSum: 18,
    totalEarnings: BigInt(50000000000000),
    specialties: 0b1, // 事业
    supportedDivinationTypes: 0b1000000, // 小六壬
    acceptsUrgent: false,
    lastActiveAt: 2000050,
  },
];

/**
 * 模拟服务套餐数据
 */
const MOCK_PACKAGES: ServicePackage[] = [
  {
    id: 1,
    divinationType: DivinationType.Bazi,
    serviceType: ServiceType.TextReading,
    name: '八字基础解读',
    description: '分析八字格局、五行喜忌、大运流年',
    price: BigInt(100000000000000),
    duration: 0,
    followUpCount: 2,
    urgentAvailable: true,
    urgentSurcharge: 5000,
    isActive: true,
    salesCount: 156,
  },
  {
    id: 2,
    divinationType: DivinationType.Ziwei,
    serviceType: ServiceType.VoiceReading,
    name: '紫微全盘解析',
    description: '十二宫位详解、大限流年分析、四化飞星',
    price: BigInt(200000000000000),
    duration: 30,
    followUpCount: 3,
    urgentAvailable: true,
    urgentSurcharge: 3000,
    isActive: true,
    salesCount: 89,
  },
  {
    id: 3,
    divinationType: DivinationType.Qimen,
    serviceType: ServiceType.TextReading,
    name: '奇门时盘预测',
    description: '当下时盘分析、用神分析、趋吉避凶建议',
    price: BigInt(80000000000000),
    duration: 0,
    followUpCount: 1,
    urgentAvailable: false,
    urgentSurcharge: 0,
    isActive: true,
    salesCount: 45,
  },
];

/**
 * 格式化金额
 */
function formatAmount(amount: bigint): string {
  const dust = Number(amount) / 1e12;
  return dust >= 1000 ? `${(dust / 1000).toFixed(1)}K` : dust.toFixed(2);
}

/**
 * 服务提供者卡片组件
 */
const ProviderCard: React.FC<{
  provider: ServiceProvider;
  onViewDetail: (provider: ServiceProvider) => void;
}> = ({ provider, onViewDetail }) => {
  const avgRating = calculateAverageRating(provider);
  const completionRate = calculateCompletionRate(provider);
  const specialties = getSpecialties(provider.specialties);
  const divinationTypes = getSupportedDivinationTypes(provider.supportedDivinationTypes);

  return (
    <Card
      hoverable
      style={{ marginBottom: 12 }}
      onClick={() => onViewDetail(provider)}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        {/* 头像 */}
        <Avatar
          size={64}
          icon={<UserOutlined />}
          style={{ backgroundColor: PROVIDER_TIER_COLORS[provider.tier] }}
        />

        {/* 信息 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 名称和等级 */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <Text strong style={{ fontSize: 16, marginRight: 8 }}>
              {provider.name}
            </Text>
            <Tag color={PROVIDER_TIER_COLORS[provider.tier]}>
              {PROVIDER_TIER_NAMES[provider.tier]}
            </Tag>
            {provider.acceptsUrgent && (
              <Tag color="red" icon={<FireOutlined />}>
                接急单
              </Tag>
            )}
          </div>

          {/* 简介 */}
          <Paragraph
            type="secondary"
            style={{ fontSize: 12, marginBottom: 8 }}
            ellipsis={{ rows: 2 }}
          >
            {provider.bio}
          </Paragraph>

          {/* 评分和订单 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <span>
              <Rate disabled defaultValue={avgRating} style={{ fontSize: 12 }} />
              <Text style={{ marginLeft: 4, fontSize: 12 }}>{avgRating.toFixed(1)}</Text>
            </span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <TeamOutlined /> {provider.completedOrders}单
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              完成率 {completionRate.toFixed(0)}%
            </Text>
          </div>

          {/* 支持的占卜类型 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {divinationTypes.slice(0, 4).map((type) => (
              <Tag key={type} style={{ fontSize: 10 }}>
                {DIVINATION_TYPE_ICONS[type]} {DIVINATION_TYPE_NAMES[type]}
              </Tag>
            ))}
            {divinationTypes.length > 4 && (
              <Tag style={{ fontSize: 10 }}>+{divinationTypes.length - 4}</Tag>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

/**
 * 服务套餐卡片组件
 */
const PackageCard: React.FC<{
  pkg: ServicePackage;
  onSelect: (pkg: ServicePackage) => void;
}> = ({ pkg, onSelect }) => (
  <Card
    size="small"
    hoverable
    style={{ marginBottom: 8 }}
    onClick={() => onSelect(pkg)}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 4 }}>
          <Tag color="blue">{DIVINATION_TYPE_NAMES[pkg.divinationType]}</Tag>
          <Tag>{SERVICE_TYPE_NAMES[pkg.serviceType]}</Tag>
        </div>
        <Text strong>{pkg.name}</Text>
        <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 4, marginTop: 4 }}>
          {pkg.description}
        </Paragraph>
        <Space size={8}>
          {pkg.followUpCount > 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              含{pkg.followUpCount}次追问
            </Text>
          )}
          {pkg.urgentAvailable && (
            <Tag color="red" style={{ fontSize: 10 }}>
              可加急
            </Tag>
          )}
          <Text type="secondary" style={{ fontSize: 11 }}>
            已售{pkg.salesCount}
          </Text>
        </Space>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Text strong style={{ fontSize: 18, color: '#f5222d' }}>
          {formatAmount(pkg.price)}
        </Text>
        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
          DUST
        </Text>
      </div>
    </div>
  </Card>
);

/**
 * 占卜服务市场页面
 */
const MarketPage: React.FC = () => {
  // 状态
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<DivinationType | 'all'>('all');
  const [filterTier, setFilterTier] = useState<ProviderTier | 'all'>('all');
  const [filterSpecialty, setFilterSpecialty] = useState<Specialty | 'all'>('all');
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [activeTab, setActiveTab] = useState<'providers' | 'packages'>('providers');

  /**
   * 筛选后的提供者列表
   */
  const filteredProviders = useMemo(() => {
    return MOCK_PROVIDERS.filter((provider) => {
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
  }, [searchText, filterType, filterTier, filterSpecialty]);

  /**
   * 筛选后的套餐列表
   */
  const filteredPackages = useMemo(() => {
    return MOCK_PACKAGES.filter((pkg) => {
      if (filterType !== 'all' && pkg.divinationType !== filterType) {
        return false;
      }
      if (searchText && !pkg.name.includes(searchText) && !pkg.description.includes(searchText)) {
        return false;
      }
      return true;
    });
  }, [searchText, filterType]);

  /**
   * 处理查看提供者详情
   */
  const handleViewProvider = useCallback((provider: ServiceProvider) => {
    setSelectedProvider(provider);
  }, []);

  /**
   * 处理选择套餐
   */
  const handleSelectPackage = useCallback((pkg: ServicePackage) => {
    console.log('Selected package:', pkg);
    // TODO: 跳转到下单页面
  }, []);

  /**
   * 渲染筛选器
   */
  const renderFilters = () => (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* 搜索框 */}
        <Search
          placeholder="搜索大师或服务"
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: '100%' }}
        />

        {/* 筛选项 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Select
            size="small"
            style={{ width: 100 }}
            value={filterType}
            onChange={setFilterType}
            options={[
              { label: '全部类型', value: 'all' },
              ...Object.entries(DIVINATION_TYPE_NAMES).map(([value, label]) => ({
                label,
                value: Number(value),
              })),
            ]}
          />
          <Select
            size="small"
            style={{ width: 90 }}
            value={filterTier}
            onChange={setFilterTier}
            options={[
              { label: '全部等级', value: 'all' },
              ...Object.entries(PROVIDER_TIER_NAMES).map(([value, label]) => ({
                label,
                value: Number(value),
              })),
            ]}
          />
          <Select
            size="small"
            style={{ width: 100 }}
            value={filterSpecialty}
            onChange={setFilterSpecialty}
            options={[
              { label: '全部领域', value: 'all' },
              ...Object.entries(SPECIALTY_NAMES).map(([value, label]) => ({
                label,
                value: Number(value),
              })),
            ]}
          />
        </div>
      </Space>
    </Card>
  );

  /**
   * 渲染提供者列表
   */
  const renderProviderList = () => (
    <div>
      {filteredProviders.length === 0 ? (
        <Empty description="暂无匹配的服务大师" />
      ) : (
        filteredProviders.map((provider) => (
          <ProviderCard
            key={provider.account}
            provider={provider}
            onViewDetail={handleViewProvider}
          />
        ))
      )}
    </div>
  );

  /**
   * 渲染套餐列表
   */
  const renderPackageList = () => (
    <div>
      {filteredPackages.length === 0 ? (
        <Empty description="暂无匹配的服务套餐" />
      ) : (
        filteredPackages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onSelect={handleSelectPackage} />
        ))
      )}
    </div>
  );

  /**
   * 渲染提供者详情
   */
  const renderProviderDetail = () => {
    if (!selectedProvider) return null;

    const avgRating = calculateAverageRating(selectedProvider);
    const completionRate = calculateCompletionRate(selectedProvider);
    const specialties = getSpecialties(selectedProvider.specialties);
    const divinationTypes = getSupportedDivinationTypes(selectedProvider.supportedDivinationTypes);

    return (
      <Card>
        <Button type="link" onClick={() => setSelectedProvider(null)} style={{ padding: 0, marginBottom: 16 }}>
          ← 返回列表
        </Button>

        {/* 基本信息 */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Avatar
            size={80}
            icon={<UserOutlined />}
            style={{ backgroundColor: PROVIDER_TIER_COLORS[selectedProvider.tier] }}
          />
          <div>
            <Title level={4} style={{ marginBottom: 8 }}>
              {selectedProvider.name}
              <Tag color={PROVIDER_TIER_COLORS[selectedProvider.tier]} style={{ marginLeft: 8 }}>
                {PROVIDER_TIER_NAMES[selectedProvider.tier]}
              </Tag>
            </Title>
            <Paragraph type="secondary">{selectedProvider.bio}</Paragraph>
          </div>
        </div>

        {/* 统计数据 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ padding: 12, backgroundColor: '#fafafa', borderRadius: 8 }}>
            <Text strong style={{ fontSize: 20, display: 'block' }}>
              {avgRating.toFixed(1)}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              评分
            </Text>
          </div>
          <div style={{ padding: 12, backgroundColor: '#fafafa', borderRadius: 8 }}>
            <Text strong style={{ fontSize: 20, display: 'block' }}>
              {selectedProvider.completedOrders}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              完成订单
            </Text>
          </div>
          <div style={{ padding: 12, backgroundColor: '#fafafa', borderRadius: 8 }}>
            <Text strong style={{ fontSize: 20, display: 'block' }}>
              {completionRate.toFixed(0)}%
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              完成率
            </Text>
          </div>
          <div style={{ padding: 12, backgroundColor: '#fafafa', borderRadius: 8 }}>
            <Text strong style={{ fontSize: 20, display: 'block' }}>
              {formatAmount(selectedProvider.totalEarnings)}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              总收入
            </Text>
          </div>
        </div>

        {/* 擅长领域 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong>擅长领域：</Text>
          <div style={{ marginTop: 8 }}>
            {specialties.map((s) => (
              <Tag key={s} color="green">
                {SPECIALTY_NAMES[s]}
              </Tag>
            ))}
          </div>
        </div>

        {/* 支持的占卜类型 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong>支持的占卜：</Text>
          <div style={{ marginTop: 8 }}>
            {divinationTypes.map((t) => (
              <Tag key={t} color="blue">
                {DIVINATION_TYPE_ICONS[t]} {DIVINATION_TYPE_NAMES[t]}
              </Tag>
            ))}
          </div>
        </div>

        <Divider />

        {/* 服务套餐 */}
        <Title level={5}>服务套餐</Title>
        {MOCK_PACKAGES.filter((pkg) => divinationTypes.includes(pkg.divinationType)).map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onSelect={handleSelectPackage} />
        ))}

        <Divider />

        {/* 咨询按钮 */}
        <Button type="primary" size="large" block icon={<ShopOutlined />}>
          立即咨询
        </Button>
      </Card>
    );
  };

  return (
    <div className="market-page" style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <Spin spinning={loading}>
        {selectedProvider ? (
          renderProviderDetail()
        ) : (
          <>
            {/* 页面标题 */}
            <Card className="header-card" style={{ marginBottom: 16 }}>
              <Title level={4}>
                <ShopOutlined /> 玄学服务市场
              </Title>
              <Paragraph type="secondary">
                汇聚各派名师，为您提供专业的命理解读服务
              </Paragraph>
            </Card>

            {/* 筛选器 */}
            {renderFilters()}

            {/* 标签页 */}
            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as 'providers' | 'packages')}
              items={[
                {
                  key: 'providers',
                  label: (
                    <span>
                      <SafetyCertificateOutlined /> 大师
                    </span>
                  ),
                  children: renderProviderList(),
                },
                {
                  key: 'packages',
                  label: (
                    <span>
                      <StarOutlined /> 服务
                    </span>
                  ),
                  children: renderPackageList(),
                },
              ]}
            />
          </>
        )}
      </Spin>
    </div>
  );
};

export default MarketPage;
