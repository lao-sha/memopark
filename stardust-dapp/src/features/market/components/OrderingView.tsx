/**
 * 下单模式视图组件
 *
 * 功能：
 * - 展示结果指示器
 * - 展开式提供者列表
 * - 根据占卜类型自动过滤套餐
 * - 支持选择套餐下单
 */

import React, { useState } from 'react';
import { Card, Button, Empty, Typography } from 'antd';
import { DivinationType, DIVINATION_TYPE_NAMES } from '../../../types/divination';
import type { ServiceProvider, ServicePackage } from '../../../types/divination';
import { UnifiedProviderCard } from './UnifiedProviderCard';
import { ResultIndicator } from './ResultIndicator';

const { Text } = Typography;

/**
 * 下单模式视图属性
 */
export interface OrderingViewProps {
  resultId: number;
  divinationType: DivinationType | null;
  providers: ServiceProvider[];
  packages: Map<string, ServicePackage[]>;
  onSelectPackage: (provider: ServiceProvider, pkg: ServicePackage) => void;
}

/**
 * 下单模式视图组件
 */
export const OrderingView: React.FC<OrderingViewProps> = ({
  resultId,
  divinationType,
  providers,
  packages,
  onSelectPackage,
}) => {
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  /**
   * 渲染提供者列表
   */
  const renderProviderList = () => {
    if (providers.length === 0) {
      return (
        <Empty
          description={
            divinationType !== null
              ? `暂无${DIVINATION_TYPE_NAMES[divinationType]}服务提供者`
              : '暂无服务提供者'
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => window.location.hash = '#/market'}>
            浏览所有大师
          </Button>
        </Empty>
      );
    }

    return (
      <div>
        {providers.map((provider) => {
          const providerPackages = packages.get(provider.account) || [];

          // 根据占卜类型过滤套餐
          const filteredPkgs = divinationType !== null
            ? providerPackages.filter((pkg) => pkg.divinationType === divinationType)
            : providerPackages;

          // 如果没有匹配的套餐，不显示该提供者
          if (filteredPkgs.length === 0) {
            return null;
          }

          return (
            <UnifiedProviderCard
              key={provider.account}
              provider={provider}
              mode="order"
              packages={filteredPkgs}
              expanded={expandedProvider === provider.account}
              onToggleExpand={() =>
                setExpandedProvider(
                  expandedProvider === provider.account ? null : provider.account
                )
              }
              onSelectPackage={(pkg) => onSelectPackage(provider, pkg)}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* 结果指示器 */}
      <ResultIndicator resultId={resultId} divinationType={divinationType} />

      {/* 提供者列表 */}
      {renderProviderList()}

      {/* 底部提示卡片 */}
      <Card
        className="market-hint-card"
        style={{
          marginTop: 16,
          borderRadius: 12,
          background: '#fffbe6',
          border: '1px solid #ffe58f',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            💰 提示：支付前请仔细阅读服务说明
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            如有问题，请查看{' '}
            <a
              href="#/help"
              style={{ color: 'var(--market-primary, #B2955D)' }}
            >
              服务协议
            </a>
            {' '}和{' '}
            <a
              href="#/help"
              style={{ color: 'var(--market-primary, #B2955D)' }}
            >
              退款政策
            </a>
          </Text>
        </div>
      </Card>
    </>
  );
};

export default OrderingView;
