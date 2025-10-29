/**
 * 免费配额状态徽章组件
 * 
 * 功能级详细中文注释：
 * 显示买家对指定做市商的剩余免费次数，可在订单创建页面等位置使用。
 * 
 * @component FreeQuotaBadge
 * @created 2025-10-22
 */

import React, { useEffect, useState } from 'react';
import { Badge, Tooltip, Spin, Tag } from 'antd';
import { GiftOutlined, ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useApi } from '../lib/polkadot';
import { getRemainingQuota, type FreeQuotaInfo } from '../services/freeQuotaService';

/**
 * 函数级详细中文注释：组件属性接口
 */
interface FreeQuotaBadgeProps {
  /** 做市商ID */
  makerId: number;
  /** 买家地址 */
  buyerAddress?: string;
  /** 显示样式：badge | tag | text */
  variant?: 'badge' | 'tag' | 'text';
  /** 是否显示详细信息 */
  showDetails?: boolean;
}

/**
 * 函数级详细中文注释：免费配额状态徽章组件
 */
const FreeQuotaBadge: React.FC<FreeQuotaBadgeProps> = ({
  makerId,
  buyerAddress,
  variant = 'badge',
  showDetails = true,
}) => {
  const { api } = useApi();
  const [loading, setLoading] = useState(true);
  const [quotaInfo, setQuotaInfo] = useState<FreeQuotaInfo | null>(null);

  /**
   * 函数级详细中文注释：加载免费配额信息
   */
  const loadQuota = async () => {
    if (!api || !buyerAddress) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const info = await getRemainingQuota(api, makerId, buyerAddress);
      setQuotaInfo(info);
    } catch (error) {
      console.error('加载配额失败:', error);
      setQuotaInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuota();
  }, [api, makerId, buyerAddress]);

  // 如果没有买家地址，不显示
  if (!buyerAddress) {
    return null;
  }

  // 加载中
  if (loading) {
    return <Spin size="small" />;
  }

  // 加载失败
  if (!quotaInfo) {
    return null;
  }

  /**
   * 函数级详细中文注释：获取配额颜色
   */
  const getQuotaColor = () => {
    if (quotaInfo.remaining === 0 && !quotaInfo.isNewBuyer) {
      return 'default'; // 配额已用完
    }
    if (quotaInfo.remaining >= 3) {
      return 'success'; // 充足
    }
    if (quotaInfo.remaining >= 1) {
      return 'warning'; // 较少
    }
    return 'default';
  };

  /**
   * 函数级详细中文注释：获取配额文本
   */
  const getQuotaText = () => {
    if (quotaInfo.isNewBuyer) {
      return `免费 ${quotaInfo.remaining} 次`;
    }
    if (quotaInfo.remaining === 0) {
      return '配额已用完';
    }
    return `剩余 ${quotaInfo.remaining} 次`;
  };

  /**
   * 函数级详细中文注释：获取详细信息
   */
  const getTooltipContent = () => {
    if (!showDetails) return null;

    return (
      <div>
        <div>
          <strong>免费配额状态：</strong>
        </div>
        <div>剩余免费次数：{quotaInfo.remaining} 次</div>
        {quotaInfo.isNewBuyer && (
          <div>新买家默认配额：{quotaInfo.defaultQuota} 次</div>
        )}
        {quotaInfo.remaining === 0 && !quotaInfo.isNewBuyer && (
          <div style={{ color: '#ff4d4f', marginTop: 8 }}>
            配额已用完，请使用普通创建订单功能
          </div>
        )}
        {quotaInfo.remaining > 0 && (
          <div style={{ color: '#52c41a', marginTop: 8 }}>
            可免费创建订单，无需支付Gas
          </div>
        )}
      </div>
    );
  };

  /**
   * 函数级详细中文注释：渲染徽章样式
   */
  const renderBadge = () => {
    const color = getQuotaColor();
    const text = getQuotaText();
    const content = getTooltipContent();

    return (
      <Tooltip title={content}>
        <Badge 
          count={quotaInfo.remaining}
          showZero
          overflowCount={99}
          style={{ 
            backgroundColor: color === 'success' ? '#52c41a' : 
                             color === 'warning' ? '#faad14' : '#d9d9d9'
          }}
        >
          <GiftOutlined 
            style={{ 
              fontSize: 20,
              color: quotaInfo.remaining > 0 ? '#52c41a' : '#8c8c8c'
            }} 
          />
        </Badge>
      </Tooltip>
    );
  };

  /**
   * 函数级详细中文注释：渲染标签样式
   */
  const renderTag = () => {
    const color = getQuotaColor();
    const text = getQuotaText();
    const content = getTooltipContent();

    let icon = <GiftOutlined />;
    if (quotaInfo.isNewBuyer) {
      icon = <CheckCircleOutlined />;
    } else if (quotaInfo.remaining > 0) {
      icon = <ThunderboltOutlined />;
    }

    return (
      <Tooltip title={content}>
        <Tag 
          color={color} 
          icon={icon}
          style={{ cursor: 'pointer' }}
        >
          {text}
        </Tag>
      </Tooltip>
    );
  };

  /**
   * 函数级详细中文注释：渲染文本样式
   */
  const renderText = () => {
    const text = getQuotaText();
    const content = getTooltipContent();
    const color = quotaInfo.remaining > 0 ? '#52c41a' : '#8c8c8c';

    return (
      <Tooltip title={content}>
        <span style={{ color, cursor: 'pointer' }}>
          <GiftOutlined style={{ marginRight: 4 }} />
          {text}
        </span>
      </Tooltip>
    );
  };

  // 根据 variant 渲染不同样式
  switch (variant) {
    case 'badge':
      return renderBadge();
    case 'tag':
      return renderTag();
    case 'text':
      return renderText();
    default:
      return renderBadge();
  }
};

export default FreeQuotaBadge;

