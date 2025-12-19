/**
 * 结果指示器组件
 *
 * 功能：
 * - 在下单模式显示已选择的占卜结果信息
 * - 提供查看结果详情的入口
 * - 应用华易网风格
 */

import React from 'react';
import { Card, Button, Typography, Tag } from 'antd';
import { CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { DivinationType, DIVINATION_TYPE_NAMES, DIVINATION_TYPE_ICONS } from '../../../types/divination';

const { Text, Title } = Typography;

/**
 * 结果指示器属性
 */
export interface ResultIndicatorProps {
  resultId: number;
  divinationType: DivinationType | null;
}

/**
 * 格式化日期
 */
const formatDate = (timestamp?: number): string => {
  if (!timestamp) {
    return new Date().toLocaleDateString('zh-CN');
  }
  return new Date(timestamp).toLocaleDateString('zh-CN');
};

/**
 * 结果指示器组件
 */
export const ResultIndicator: React.FC<ResultIndicatorProps> = ({
  resultId,
  divinationType,
}) => {
  const handleViewResult = () => {
    // 根据占卜类型跳转到对应的结果页面
    if (divinationType === DivinationType.Meihua) {
      window.location.hash = `#/meihua/hexagram/${resultId}`;
    } else if (divinationType === DivinationType.Bazi) {
      window.location.hash = `#/bazi/${resultId}`;
    } else if (divinationType === DivinationType.Liuyao) {
      window.location.hash = `#/liuyao/${resultId}`;
    } else if (divinationType === DivinationType.Qimen) {
      window.location.hash = `#/qimen/detail/${resultId}`;
    } else if (divinationType === DivinationType.Ziwei) {
      window.location.hash = `#/ziwei/interpretation/${resultId}`;
    } else if (divinationType === DivinationType.XiaoLiuRen) {
      window.location.hash = `#/xiaoliuren?resultId=${resultId}`;
    } else if (divinationType === DivinationType.Daliuren) {
      window.location.hash = `#/daliuren/detail/${resultId}`;
    } else if (divinationType === DivinationType.Tarot) {
      window.location.hash = `#/tarot/reading/${resultId}`;
    } else {
      window.location.hash = `#/divination`;
    }
  };

  return (
    <Card
      className="result-indicator"
      style={{
        background: 'linear-gradient(135deg, rgba(93, 186, 170, 0.1) 0%, rgba(93, 186, 170, 0.05) 100%)',
        border: '2px solid rgba(93, 186, 170, 0.3)',
        borderRadius: 12,
        marginBottom: 16,
      }}
      bodyStyle={{ padding: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
            <Title level={5} style={{ margin: 0, color: 'var(--market-text-primary, #5C4033)' }}>
              已选择占卜结果
            </Title>
          </div>
          <div style={{ paddingLeft: 28 }}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ color: 'var(--market-text-primary, #5C4033)' }}>
                结果编号：
              </Text>
              <Tag color="blue" style={{ fontSize: 12 }}>
                #{resultId}
              </Tag>
            </div>
            {divinationType !== null && (
              <div style={{ marginBottom: 4 }}>
                <Text strong style={{ color: 'var(--market-text-primary, #5C4033)' }}>
                  占卜类型：
                </Text>
                <Tag color="purple" style={{ fontSize: 12 }}>
                  {DIVINATION_TYPE_ICONS[divinationType]} {DIVINATION_TYPE_NAMES[divinationType]}
                </Tag>
              </div>
            )}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                创建时间：{formatDate()}
              </Text>
            </div>
          </div>
        </div>
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={handleViewResult}
          style={{ color: 'var(--market-primary, #B2955D)' }}
        >
          查看详情
        </Button>
      </div>
    </Card>
  );
};

export default ResultIndicator;
