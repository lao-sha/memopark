/**
 * 统一套餐卡片组件
 *
 * 功能：
 * - 支持浏览模式和下单模式两种显示样式
 * - 浏览模式：显示提供者信息
 * - 下单模式：显示快速下单按钮
 * - 应用华易网风格配色
 */

import React from 'react';
import { Card, Button, Typography, Tag, Space, Avatar } from 'antd';
import {
  MessageOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  PhoneOutlined,
  FireOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ServiceProvider, ServicePackage } from '../../../types/divination';
import {
  ServiceType,
  SERVICE_TYPE_NAMES,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  PROVIDER_TIER_COLORS,
} from '../../../types/divination';

const { Text, Paragraph } = Typography;

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
 * 统一套餐卡片属性
 */
export interface UnifiedPackageCardProps {
  pkg: ServicePackage;
  provider?: ServiceProvider;  // 浏览模式需要
  mode: 'browse' | 'order';
  onSelect: () => void;
}

/**
 * 格式化价格
 */
const formatPrice = (price: bigint): string => {
  const dust = Number(price) / 1e12;
  return dust.toFixed(2);
};

/**
 * 提供者迷你信息组件（浏览模式）
 */
const ProviderMiniInfo: React.FC<{ provider: ServiceProvider }> = ({ provider }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      padding: '8px 0',
      borderTop: '1px solid var(--market-border, #E8DCC4)',
    }}
  >
    <Avatar
      size={24}
      icon={<UserOutlined />}
      src={provider.avatarCid ? `https://ipfs.io/ipfs/${provider.avatarCid}` : undefined}
      style={{ backgroundColor: PROVIDER_TIER_COLORS[provider.tier] }}
    />
    <Text style={{ fontSize: 12, color: 'var(--market-text-secondary, #8B7355)' }}>
      {provider.name}
    </Text>
  </div>
);

/**
 * 统一套餐卡片组件
 */
export const UnifiedPackageCard: React.FC<UnifiedPackageCardProps> = ({
  pkg,
  provider,
  mode,
  onSelect,
}) => {
  return (
    <Card
      size="small"
      className="unified-package-card"
      hoverable
      style={{
        marginBottom: 8,
        background: 'var(--market-bg-card, #FFFFFF)',
        border: '1px solid var(--market-border, #E8DCC4)',
        borderRadius: 8,
        transition: 'all 0.2s ease',
      }}
      onClick={onSelect}
    >
      {/* 套餐头部：服务类型 + 价格 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <Space size="small">
          <span style={{ color: 'var(--market-primary, #B2955D)', fontSize: 16 }}>
            {SERVICE_ICONS[pkg.serviceType]}
          </span>
          <Text strong style={{ fontSize: 14, color: 'var(--market-text-primary, #5C4033)' }}>
            {pkg.name}
          </Text>
        </Space>
        <div style={{ textAlign: 'right' }}>
          <Text strong style={{ fontSize: 16, color: 'var(--market-primary, #B2955D)' }}>
            {formatPrice(pkg.price)}
          </Text>
          <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
            DUST
          </Text>
        </div>
      </div>

      {/* 套餐描述 */}
      <Paragraph
        type="secondary"
        style={{
          fontSize: 12,
          marginBottom: 8,
          color: 'var(--market-text-secondary, #8B7355)',
        }}
        ellipsis={{ rows: 2 }}
      >
        {pkg.description}
      </Paragraph>

      {/* 套餐标签 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: mode === 'browse' && provider ? 0 : 8 }}>
        <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
          {DIVINATION_TYPE_ICONS[pkg.divinationType]} {DIVINATION_TYPE_NAMES[pkg.divinationType]}
        </Tag>
        <Tag style={{ fontSize: 10, margin: 0 }}>
          {SERVICE_TYPE_NAMES[pkg.serviceType]}
        </Tag>
        {pkg.followUpCount > 0 && (
          <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>
            {pkg.followUpCount}次追问
          </Tag>
        )}
        {pkg.urgentAvailable && (
          <Tag color="red" icon={<FireOutlined />} style={{ fontSize: 10, margin: 0 }}>
            加急
          </Tag>
        )}
        <Tag style={{ fontSize: 10, margin: 0 }}>
          已售{pkg.salesCount}
        </Tag>
      </div>

      {/* 浏览模式：显示提供者信息 */}
      {mode === 'browse' && provider && <ProviderMiniInfo provider={provider} />}

      {/* 下单模式：显示快速下单按钮 */}
      {mode === 'order' && (
        <Button
          type="primary"
          size="small"
          block
          style={{
            background: 'var(--market-primary, #B2955D)',
            borderColor: 'var(--market-primary, #B2955D)',
            marginTop: 8,
          }}
        >
          立即选择
        </Button>
      )}
    </Card>
  );
};

export default UnifiedPackageCard;
