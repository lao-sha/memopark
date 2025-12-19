/**
 * 浏览模式视图组件
 *
 * 功能：
 * - 双Tab视图：大师列表 + 服务套餐列表
 * - 支持搜索和筛选
 * - 点击查看大师详情
 */

import React, { useState } from 'react';
import { Card, Button, Tabs, Empty, Typography } from 'antd';
import type { ServiceProvider, ServicePackage } from '../../../types/divination';
import { UnifiedProviderCard } from './UnifiedProviderCard';
import { UnifiedPackageCard } from './UnifiedPackageCard';

const { Text } = Typography;

/**
 * 浏览模式视图属性
 */
export interface BrowsingViewProps {
  providers: ServiceProvider[];
  packages: Map<string, ServicePackage[]>;
  onViewProviderDetail: (provider: ServiceProvider) => void;
}

/**
 * 浏览模式视图组件
 */
export const BrowsingView: React.FC<BrowsingViewProps> = ({
  providers,
  packages,
  onViewProviderDetail,
}) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'packages'>('providers');

  /**
   * 获取所有套餐（用于服务套餐Tab）
   */
  const allPackages = React.useMemo(() => {
    const pkgs: Array<{ pkg: ServicePackage; provider: ServiceProvider }> = [];
    providers.forEach((provider) => {
      const providerPackages = packages.get(provider.account) || [];
      providerPackages.forEach((pkg) => {
        pkgs.push({ pkg, provider });
      });
    });
    return pkgs;
  }, [providers, packages]);

  /**
   * 渲染大师列表
   */
  const renderProviderList = () => {
    if (providers.length === 0) {
      return (
        <Empty
          description="暂无入驻大师"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => window.location.hash = '#/provider/register'}>
            成为首位大师
          </Button>
        </Empty>
      );
    }

    return (
      <div>
        {providers.map((provider) => (
          <UnifiedProviderCard
            key={provider.account}
            provider={provider}
            mode="browse"
            onViewDetail={() => onViewProviderDetail(provider)}
          />
        ))}
      </div>
    );
  };

  /**
   * 渲染服务套餐列表
   */
  const renderPackageList = () => {
    if (allPackages.length === 0) {
      return (
        <Empty
          description="暂无服务套餐"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <div>
        {allPackages.map(({ pkg, provider }) => (
          <UnifiedPackageCard
            key={`${provider.account}-${pkg.id}`}
            pkg={pkg}
            provider={provider}
            mode="browse"
            onSelect={() => onViewProviderDetail(provider)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      {/* 双Tab视图 */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'providers' | 'packages')}
        items={[
          {
            key: 'providers',
            label: (
              <span style={{ fontSize: 14 }}>
                🎓 大师 {providers.length > 0 && `(${providers.length})`}
              </span>
            ),
            children: renderProviderList(),
          },
          {
            key: 'packages',
            label: (
              <span style={{ fontSize: 14 }}>
                📦 服务套餐 {allPackages.length > 0 && `(${allPackages.length})`}
              </span>
            ),
            children: renderPackageList(),
          },
        ]}
      />

      {/* 底部引导卡片 */}
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
          <Text strong>💡 还没有占卜结果？</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            先选择一种占卜方式，获取结果后再找大师解读
          </Text>
          <br />
          <Button
            type="primary"
            size="small"
            style={{ marginTop: 12 }}
            onClick={() => window.location.hash = '#/divination'}
          >
            去占卜
          </Button>
        </div>
      </Card>
    </>
  );
};

export default BrowsingView;
