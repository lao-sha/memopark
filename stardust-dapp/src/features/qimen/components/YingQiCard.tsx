/**
 * 应期推算卡片组件
 *
 * 功能：
 * - 显示应期推算结果
 * - 显示主应期和次应期
 * - 显示应期单位和范围描述
 * - 显示吉利和不利时间
 */

import React from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Space,
  Typography,
  Statistic,
  Alert,
  Divider,
} from 'antd';
import {
  ClockCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { YingQiAnalysis } from '../../../types/qimen';
import { YING_QI_UNIT_NAMES } from '../../../types/qimen';

const { Text, Paragraph } = Typography;

interface Props {
  analysis: YingQiAnalysis;
}

export const YingQiCard: React.FC<Props> = ({ analysis }) => {
  /**
   * 获取应期说明
   */
  const getYingQiExplanation = (): string => {
    switch (analysis.unit) {
      case 'Hour':
        return '应期在数个时辰内，变化迅速，需把握当下时机。';
      case 'Day':
        return '应期在数日内，近期即可见分晓，宜密切关注。';
      case 'Xun':
        return '应期在数旬内（一旬为十日），约在半月至一月左右。';
      case 'Month':
        return '应期在数月内，需耐心等待，不宜急躁。';
      case 'Season':
        return '应期在数个季度内，属中长期变化，宜持续观察。';
      case 'Year':
        return '应期在数年内，为长期趋势，需长远规划。';
      default:
        return '应期时间待定，建议综合其他因素判断。';
    }
  };

  /**
   * 获取应期紧急程度
   */
  const getUrgencyLevel = (): { level: string; color: string; text: string } => {
    switch (analysis.unit) {
      case 'Hour':
        return { level: '极急', color: 'red', text: '立即' };
      case 'Day':
        return { level: '紧急', color: 'orange', text: '近期' };
      case 'Xun':
        return { level: '较急', color: 'gold', text: '半月内' };
      case 'Month':
        return { level: '一般', color: 'blue', text: '数月内' };
      case 'Season':
        return { level: '不急', color: 'cyan', text: '数季内' };
      case 'Year':
        return { level: '缓慢', color: 'purple', text: '数年内' };
      default:
        return { level: '未知', color: 'default', text: '待定' };
    }
  };

  const urgency = getUrgencyLevel();

  return (
    <Card
      title={
        <Space>
          <ClockCircleOutlined />
          应期推算
          <Tag color={urgency.color}>{urgency.level}</Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {/* 应期概览 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Statistic
            title="主应期数"
            value={analysis.primaryNum}
            prefix={<CalendarOutlined />}
            suffix={YING_QI_UNIT_NAMES[analysis.unit]}
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col xs={12} sm={8}>
          <Statistic
            title="次应期①"
            value={analysis.secondaryNums[0]}
            prefix={<CalendarOutlined />}
            suffix={YING_QI_UNIT_NAMES[analysis.unit]}
            valueStyle={{ color: '#52c41a', fontSize: 16 }}
          />
        </Col>
        <Col xs={12} sm={8}>
          <Statistic
            title="次应期②"
            value={analysis.secondaryNums[1]}
            prefix={<CalendarOutlined />}
            suffix={YING_QI_UNIT_NAMES[analysis.unit]}
            valueStyle={{ color: '#52c41a', fontSize: 16 }}
          />
        </Col>
      </Row>

      <Divider />

      {/* 应期范围描述 */}
      <Alert
        message="应期范围"
        description={
          <Space direction="vertical" style={{ width: '100%' }}>
            <Paragraph style={{ marginBottom: 8 }}>
              <ClockCircleOutlined /> {analysis.rangeDesc}
            </Paragraph>
            <Text type="secondary">{getYingQiExplanation()}</Text>
          </Space>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 吉利时间（如果有） */}
      {analysis.auspiciousTimes && analysis.auspiciousTimes.length > 0 && (
        <>
          <Space direction="vertical" size="small" style={{ width: '100%', marginBottom: 12 }}>
            <Text strong>
              <CheckCircleOutlined style={{ color: '#52c41a' }} /> 吉利时间
            </Text>
            <Text type="secondary">以下时间段相对有利，宜把握机会：</Text>
            <div>
              {/* 这里可以根据实际数据展示具体时间 */}
              <Tag color="success">待系统完善</Tag>
            </div>
          </Space>
          <Divider />
        </>
      )}

      {/* 不利时间（如果有） */}
      {analysis.inauspiciousTimes && analysis.inauspiciousTimes.length > 0 && (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text strong>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 不利时间
          </Text>
          <Text type="secondary">以下时间段相对不利，宜谨慎行事：</Text>
          <div>
            {/* 这里可以根据实际数据展示具体时间 */}
            <Tag color="error">待系统完善</Tag>
          </div>
        </Space>
      )}

      <Divider />

      {/* 应期说明 */}
      <Alert
        message={
          <Space>
            <InfoCircleOutlined />
            应期说明
          </Space>
        }
        description={
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>主应期数：基于用神宫位推算，为主要参考时间</li>
            <li>次应期数：基于值符值使推算，可作为辅助参考</li>
            <li>应期单位：{YING_QI_UNIT_NAMES[analysis.unit]}，表示时间的计量单位</li>
            <li>实际应期：受多种因素影响，仅供参考，不可执着</li>
          </ul>
        }
        type="warning"
        showIcon
      />
    </Card>
  );
};
