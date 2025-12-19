/**
 * 提供者详情视图组件
 *
 * 功能：
 * - 显示大师完整档案
 * - 展示所有服务套餐
 * - 提供"立即咨询"入口
 * - 返回列表功能
 */

import React from 'react';
import { Card, Button, Typography, Statistic, Tag, Divider, Avatar, Rate } from 'antd';
import { ArrowLeftOutlined, UserOutlined, ShopOutlined } from '@ant-design/icons';
import type { ServiceProvider, ServicePackage } from '../../../types/divination';
import {
  PROVIDER_TIER_NAMES,
  PROVIDER_TIER_COLORS,
  DIVINATION_TYPE_ICONS,
  DIVINATION_TYPE_NAMES,
  SPECIALTY_NAMES,
  calculateAverageRating,
  calculateCompletionRate,
  getSpecialties,
  getSupportedDivinationTypes,
} from '../../../types/divination';
import { UnifiedPackageCard } from './UnifiedPackageCard';

const { Title, Text, Paragraph } = Typography;

/**
 * 提供者详情视图属性
 */
export interface ProviderDetailViewProps {
  provider: ServiceProvider;
  packages: ServicePackage[];
  onBack: () => void;
  onSelectPackage?: (pkg: ServicePackage) => void;
}

/**
 * 格式化金额
 */
const formatAmount = (amount: bigint): string => {
  const dust = Number(amount) / 1e12;
  return dust >= 1000 ? `${(dust / 1000).toFixed(1)}K` : dust.toFixed(0);
};

/**
 * 提供者详情视图组件
 */
export const ProviderDetailView: React.FC<ProviderDetailViewProps> = ({
  provider,
  packages,
  onBack,
  onSelectPackage,
}) => {
  const avgRating = calculateAverageRating(provider);
  const completionRate = calculateCompletionRate(provider);
  const specialties = getSpecialties(provider.specialties);
  const divinationTypes = getSupportedDivinationTypes(provider.supportedDivinationTypes);

  return (
    <div className="provider-detail-view">
      {/* 返回按钮 */}
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={onBack}
        style={{
          padding: 0,
          marginBottom: 16,
          color: 'var(--market-primary, #B2955D)',
        }}
      >
        返回列表
      </Button>

      {/* 大师信息卡片 */}
      <Card
        style={{
          marginBottom: 16,
          borderRadius: 12,
          border: '2px solid var(--market-border, #E8DCC4)',
        }}
      >
        {/* 基本信息 */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Avatar
            size={80}
            icon={<UserOutlined />}
            src={provider.avatarCid ? `https://ipfs.io/ipfs/${provider.avatarCid}` : undefined}
            style={{ backgroundColor: PROVIDER_TIER_COLORS[provider.tier], flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 8 }}>
              <Title level={4} style={{ margin: 0, display: 'inline-block', color: 'var(--market-text-primary, #5C4033)' }}>
                {provider.name}
              </Title>
              <Tag
                className="master-tier-tag"
                style={{
                  marginLeft: 8,
                  background: 'var(--market-gold, #D4AF37)',
                  color: 'var(--market-text-primary, #5C4033)',
                  border: '2px solid var(--market-primary-dark, #9A7D4A)',
                  fontWeight: 600,
                }}
              >
                {PROVIDER_TIER_NAMES[provider.tier]}
              </Tag>
              {!provider.isActive && (
                <Tag color="default" style={{ marginLeft: 8 }}>
                  休息中
                </Tag>
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <Rate disabled value={avgRating} allowHalf style={{ fontSize: 14 }} />
              <Text style={{ marginLeft: 8, color: 'var(--market-text-secondary, #8B7355)' }}>
                {avgRating.toFixed(1)} ({provider.totalRatings}评价)
              </Text>
            </div>
            <Paragraph style={{ marginBottom: 0, color: 'var(--market-text-secondary, #8B7355)' }}>
              {provider.bio}
            </Paragraph>
          </div>
        </div>

        {/* 统计数据 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ padding: 12, background: '#fafafa', borderRadius: 8 }}>
            <Statistic
              title="评分"
              value={avgRating}
              precision={1}
              valueStyle={{ fontSize: 20, color: 'var(--market-primary, #B2955D)' }}
            />
          </div>
          <div style={{ padding: 12, background: '#fafafa', borderRadius: 8 }}>
            <Statistic
              title="完成订单"
              value={provider.completedOrders}
              valueStyle={{ fontSize: 20, color: 'var(--market-primary, #B2955D)' }}
            />
          </div>
          <div style={{ padding: 12, background: '#fafafa', borderRadius: 8 }}>
            <Statistic
              title="完成率"
              value={completionRate}
              suffix="%"
              precision={0}
              valueStyle={{ fontSize: 20, color: 'var(--market-primary, #B2955D)' }}
            />
          </div>
          <div style={{ padding: 12, background: '#fafafa', borderRadius: 8 }}>
            <Statistic
              title="总收入"
              value={formatAmount(provider.totalEarnings)}
              valueStyle={{ fontSize: 20, color: 'var(--market-primary, #B2955D)' }}
            />
          </div>
        </div>

        {/* 擅长领域 */}
        {specialties.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ color: 'var(--market-text-primary, #5C4033)' }}>
              擅长领域：
            </Text>
            <div style={{ marginTop: 8 }}>
              {specialties.map((s) => (
                <Tag key={s} color="green" style={{ marginBottom: 4 }}>
                  {SPECIALTY_NAMES[s]}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* 支持的占卜类型 */}
        <div>
          <Text strong style={{ color: 'var(--market-text-primary, #5C4033)' }}>
            支持的占卜：
          </Text>
          <div style={{ marginTop: 8 }}>
            {divinationTypes.map((t) => (
              <Tag key={t} color="purple" style={{ marginBottom: 4 }}>
                {DIVINATION_TYPE_ICONS[t]} {DIVINATION_TYPE_NAMES[t]}
              </Tag>
            ))}
          </div>
        </div>
      </Card>

      <Divider />

      {/* 服务套餐 */}
      <Card
        style={{
          marginBottom: 16,
          borderRadius: 12,
          border: '1px solid var(--market-border, #E8DCC4)',
        }}
      >
        <Title level={5} style={{ color: 'var(--market-text-primary, #5C4033)' }}>
          服务套餐 ({packages.length})
        </Title>
        {packages.length === 0 ? (
          <Text type="secondary">暂无服务套餐</Text>
        ) : (
          packages.map((pkg) => (
            <UnifiedPackageCard
              key={pkg.id}
              pkg={pkg}
              provider={provider}
              mode="browse"
              onSelect={() => onSelectPackage?.(pkg)}
            />
          ))
        )}
      </Card>

      {/* 咨询按钮 */}
      <Button
        type="primary"
        size="large"
        block
        icon={<ShopOutlined />}
        disabled={!provider.isActive}
        onClick={() => {
          // 提示用户先完成占卜
          window.location.hash = '#/divination';
        }}
        style={{
          background: 'var(--market-primary, #B2955D)',
          borderColor: 'var(--market-primary, #B2955D)',
          borderRadius: 8,
        }}
      >
        {provider.isActive ? '立即咨询（需先占卜）' : '大师休息中'}
      </Button>
    </div>
  );
};

export default ProviderDetailView;
