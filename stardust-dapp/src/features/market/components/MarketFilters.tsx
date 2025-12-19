/**
 * 市场筛选器组件
 *
 * 功能：
 * - 搜索框（大师名称、简介、服务名称）
 * - 占卜类型筛选
 * - 大师等级筛选
 * - 擅长领域筛选
 * - 应用华易网风格
 */

import React from 'react';
import { Card, Input, Select, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import {
  DivinationType,
  ProviderTier,
  Specialty,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  PROVIDER_TIER_NAMES,
  SPECIALTY_NAMES,
} from '../../../types/divination';

const { Search } = Input;

/**
 * 筛选器属性
 */
export interface MarketFiltersProps {
  searchText: string;
  filterType: DivinationType | 'all';
  filterTier: ProviderTier | 'all';
  filterSpecialty: Specialty | 'all';
  onSearchChange: (value: string) => void;
  onTypeChange: (value: DivinationType | 'all') => void;
  onTierChange: (value: ProviderTier | 'all') => void;
  onSpecialtyChange: (value: Specialty | 'all') => void;
  showAdvanced?: boolean;  // 是否显示高级筛选（等级、领域）
}

/**
 * 市场筛选器组件
 */
export const MarketFilters: React.FC<MarketFiltersProps> = ({
  searchText,
  filterType,
  filterTier,
  filterSpecialty,
  onSearchChange,
  onTypeChange,
  onTierChange,
  onSpecialtyChange,
  showAdvanced = true,
}) => {
  return (
    <Card
      size="small"
      className="market-filters"
      style={{
        marginBottom: 16,
        borderRadius: 12,
        border: '1px solid var(--market-border, #E8DCC4)',
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* 搜索框 */}
        <Search
          placeholder="搜索大师或服务..."
          allowClear
          enterButton={<SearchOutlined />}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: '100%' }}
        />

        {/* 筛选项 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* 占卜类型 */}
          <Select
            size="small"
            style={{ width: 100 }}
            value={filterType}
            onChange={onTypeChange}
            options={[
              { label: '全部类型', value: 'all' },
              ...Object.entries(DIVINATION_TYPE_NAMES).map(([value, label]) => ({
                label: `${DIVINATION_TYPE_ICONS[Number(value)]} ${label}`,
                value: Number(value),
              })),
            ]}
          />

          {/* 高级筛选：等级和领域 */}
          {showAdvanced && (
            <>
              {/* 大师等级 */}
              <Select
                size="small"
                style={{ width: 90 }}
                value={filterTier}
                onChange={onTierChange}
                options={[
                  { label: '全部等级', value: 'all' },
                  ...Object.entries(PROVIDER_TIER_NAMES).map(([value, label]) => ({
                    label,
                    value: Number(value),
                  })),
                ]}
              />

              {/* 擅长领域 */}
              <Select
                size="small"
                style={{ width: 100 }}
                value={filterSpecialty}
                onChange={onSpecialtyChange}
                options={[
                  { label: '全部领域', value: 'all' },
                  ...Object.entries(SPECIALTY_NAMES).map(([value, label]) => ({
                    label,
                    value: Number(value),
                  })),
                ]}
              />
            </>
          )}
        </div>
      </Space>
    </Card>
  );
};

export default MarketFilters;
