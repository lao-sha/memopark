/**
 * 统一大师卡片组件
 *
 * 功能：
 * - 支持浏览模式和下单模式两种显示样式
 * - 浏览模式：显示基本信息 + "查看详情"按钮
 * - 下单模式：可展开查看套餐列表
 * - 应用华易网风格配色
 */

import React from 'react';
import { Card, Button, Typography, Tag, Avatar, Rate, Divider, Space, Badge } from 'antd';
import { UserOutlined, FireOutlined } from '@ant-design/icons';
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

const { Text, Paragraph } = Typography;

/**
 * 统一大师卡片属性
 */
export interface UnifiedProviderCardProps {
  provider: ServiceProvider;
  mode: 'browse' | 'order';
  packages?: ServicePackage[];
  expanded?: boolean;
  onViewDetail?: () => void;
  onSelectPackage?: (pkg: ServicePackage) => void;
  onToggleExpand?: () => void;
}

/**
 * 大师基本信息组件
 */
const ProviderBasicInfo: React.FC<{
  provider: ServiceProvider;
  onClick?: () => void;
}> = ({ provider, onClick }) => {
  const avgRating = calculateAverageRating(provider);
  const completionRate = calculateCompletionRate(provider);
  const supportedTypes = getSupportedDivinationTypes(provider.supportedDivinationTypes);

  return (
    <div
      style={{ display: 'flex', gap: 12, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {/* 头像 */}
      <Badge count={provider.isActive ? 0 : '休息中'} offset={[-5, 5]}>
        <Avatar
          size={64}
          icon={<UserOutlined />}
          src={provider.avatarCid ? `https://ipfs.io/ipfs/${provider.avatarCid}` : undefined}
          style={{ backgroundColor: PROVIDER_TIER_COLORS[provider.tier] }}
        />
      </Badge>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 名称和等级 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <Text strong style={{ fontSize: 16, color: 'var(--market-text-primary, #5C4033)' }}>
            {provider.name}
          </Text>
          <Tag
            className="master-tier-tag"
            style={{
              background: 'var(--market-gold, #D4AF37)',
              color: 'var(--market-text-primary, #5C4033)',
              border: '2px solid var(--market-primary-dark, #9A7D4A)',
              fontWeight: 600,
            }}
          >
            {PROVIDER_TIER_NAMES[provider.tier]}
          </Tag>
          {provider.acceptsUrgent && (
            <Tag color="red" icon={<FireOutlined />} style={{ fontSize: 11 }}>
              接急单
            </Tag>
          )}
        </div>

        {/* 评分和订单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Rate disabled value={avgRating} allowHalf style={{ fontSize: 12 }} />
            <Text style={{ marginLeft: 4, fontSize: 12, color: 'var(--market-text-secondary, #8B7355)' }}>
              {avgRating.toFixed(1)} ({provider.totalRatings}评价)
            </Text>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            完成 {provider.completedOrders}单
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {completionRate.toFixed(0)}%
          </Text>
        </div>

        {/* 支持的占卜类型 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {supportedTypes.slice(0, 4).map((t) => (
            <Tag key={t} color="purple" style={{ fontSize: 10, margin: 0 }}>
              {DIVINATION_TYPE_ICONS[t]} {DIVINATION_TYPE_NAMES[t]}
            </Tag>
          ))}
          {supportedTypes.length > 4 && (
            <Tag style={{ fontSize: 10, margin: 0 }}>+{supportedTypes.length - 4}</Tag>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 套餐列表组件（用于下单模式展开）
 */
const PackageList: React.FC<{
  packages: ServicePackage[];
  onSelect?: (pkg: ServicePackage) => void;
}> = ({ packages, onSelect }) => {
  if (packages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--market-text-hint, #A69784)' }}>
        暂无服务套餐
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {packages.map((pkg) => (
        <div
          key={pkg.id}
          style={{
            padding: 12,
            marginBottom: 8,
            background: 'linear-gradient(135deg, rgba(217, 104, 90, 0.05) 0%, rgba(217, 104, 90, 0.1) 100%)',
            border: '1px solid var(--market-border, #E8DCC4)',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => onSelect?.(pkg)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--market-primary, #B2955D)';
            e.currentTarget.style.transform = 'translateX(2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--market-border, #E8DCC4)';
            e.currentTarget.style.transform = 'translateX(0)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text strong style={{ color: 'var(--market-text-primary, #5C4033)' }}>{pkg.name}</Text>
            <Text strong style={{ color: 'var(--market-primary, #B2955D)', fontSize: 16 }}>
              {(Number(pkg.price) / 1e12).toFixed(2)} DUST
            </Text>
          </div>
          <Paragraph
            type="secondary"
            style={{ fontSize: 12, marginBottom: 8, color: 'var(--market-text-secondary, #8B7355)' }}
            ellipsis={{ rows: 2 }}
          >
            {pkg.description}
          </Paragraph>
          <Space size="small" wrap>
            {pkg.followUpCount > 0 && (
              <Tag style={{ fontSize: 10, margin: 0 }}>含{pkg.followUpCount}次追问</Tag>
            )}
            {pkg.urgentAvailable && (
              <Tag color="red" icon={<FireOutlined />} style={{ fontSize: 10, margin: 0 }}>
                可加急
              </Tag>
            )}
            <Tag style={{ fontSize: 10, margin: 0 }}>已售{pkg.salesCount}</Tag>
          </Space>
        </div>
      ))}
    </div>
  );
};

/**
 * 统一大师卡片组件
 */
export const UnifiedProviderCard: React.FC<UnifiedProviderCardProps> = ({
  provider,
  mode,
  packages = [],
  expanded = false,
  onViewDetail,
  onSelectPackage,
  onToggleExpand,
}) => {
  const specialties = getSpecialties(provider.specialties);

  // 浏览模式：显示"查看详情"按钮
  if (mode === 'browse') {
    return (
      <Card
        className="unified-provider-card"
        hoverable
        style={{
          marginBottom: 12,
          background: 'var(--market-bg-card, #FFFFFF)',
          border: '2px solid var(--market-border, #E8DCC4)',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(92, 64, 51, 0.08)',
          transition: 'all 0.3s ease',
        }}
        onClick={onViewDetail}
      >
        <ProviderBasicInfo provider={provider} />

        {/* 简介 */}
        <Paragraph
          type="secondary"
          style={{
            fontSize: 12,
            marginTop: 12,
            marginBottom: 8,
            color: 'var(--market-text-secondary, #8B7355)',
          }}
          ellipsis={{ rows: 2 }}
        >
          {provider.bio}
        </Paragraph>

        {/* 擅长领域 */}
        {specialties.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: 'var(--market-text-hint, #A69784)' }}>擅长：</Text>
            {specialties.slice(0, 3).map((s) => (
              <Tag key={s} style={{ fontSize: 10, margin: '0 4px 4px 0' }}>
                {SPECIALTY_NAMES[s]}
              </Tag>
            ))}
          </div>
        )}

        <Divider style={{ margin: '12px 0' }} />

        <Button
          type="primary"
          block
          style={{
            background: 'var(--market-primary, #B2955D)',
            borderColor: 'var(--market-primary, #B2955D)',
          }}
        >
          查看详情
        </Button>
      </Card>
    );
  }

  // 下单模式：可展开查看套餐
  return (
    <Card
      className="unified-provider-card ordering-mode"
      style={{
        marginBottom: 12,
        background: 'var(--market-bg-card, #FFFFFF)',
        border: '2px solid var(--market-border, #E8DCC4)',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(92, 64, 51, 0.08)',
      }}
    >
      <ProviderBasicInfo provider={provider} onClick={onToggleExpand} />

      {/* 简介 */}
      <Paragraph
        type="secondary"
        style={{
          fontSize: 12,
          marginTop: 12,
          marginBottom: 8,
          color: 'var(--market-text-secondary, #8B7355)',
        }}
        ellipsis={{ rows: 2 }}
      >
        {provider.bio}
      </Paragraph>

      {/* 擅长领域 */}
      {specialties.length > 0 && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          {specialties.slice(0, 4).map((s) => (
            <Tag key={s} style={{ fontSize: 10, margin: '0 4px 4px 0' }}>
              {SPECIALTY_NAMES[s]}
            </Tag>
          ))}
        </div>
      )}

      {/* 展开的套餐列表 */}
      {expanded && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <PackageList packages={packages} onSelect={onSelectPackage} />
        </>
      )}

      {/* 展开/收起按钮 */}
      <Button
        type="link"
        block
        onClick={onToggleExpand}
        style={{
          marginTop: 8,
          color: 'var(--market-primary, #B2955D)',
        }}
      >
        {expanded ? '▲ 收起套餐' : `▼ 查看套餐 (${packages.length})`}
      </Button>
    </Card>
  );
};

export default UnifiedProviderCard;
