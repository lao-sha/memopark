/**
 * 用神分析卡片组件
 *
 * 功能：
 * - 显示主用神和次用神信息
 * - 显示用神旺衰和得力状态
 * - 显示用神吉凶和评分
 * - 根据问事类型调整显示
 */

import React from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Space,
  Typography,
  Descriptions,
  Progress,
  Alert,
} from 'antd';
import {
  AimOutlined,
  ThunderboltOutlined,
  StarOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { YongShenAnalysis } from '../../../types/qimen';
import {
  QUESTION_TYPE_NAMES,
  JIU_GONG_NAMES,
  YONG_SHEN_TYPE_NAMES,
  WANG_SHUAI_STATUS_NAMES,
  DE_LI_STATUS_NAMES,
  FORTUNE_NAMES,
  FORTUNE_COLORS,
} from '../../../types/qimen';

const { Text, Paragraph } = Typography;

interface Props {
  analysis: YongShenAnalysis;
}

export const YongShenCard: React.FC<Props> = ({ analysis }) => {
  /**
   * 获取得力状态颜色
   */
  const getDeLiColor = (deLi: string): string => {
    const colorMap: Record<string, string> = {
      DaDeLi: '#52c41a',
      DeLi: '#73d13d',
      Ping: '#d9d9d9',
      ShiLi: '#ff7875',
      DaShiLi: '#f5222d',
    };
    return colorMap[deLi] || '#d9d9d9';
  };

  /**
   * 获取旺衰状态颜色
   */
  const getWangShuaiColor = (wangShuai: string): string => {
    const colorMap: Record<string, string> = {
      WangXiang: '#52c41a',
      Xiang: '#1890ff',
      Xiu: '#faad14',
      Qiu: '#fa541c',
      Si: '#8c8c8c',
    };
    return colorMap[wangShuai] || '#d9d9d9';
  };

  /**
   * 获取用神建议
   */
  const getYongShenAdvice = (): string => {
    if (analysis.score >= 80) {
      return '用神得力，旺相有气，当前时机极佳，宜积极进取。';
    } else if (analysis.score >= 60) {
      return '用神尚可，有一定助力，可以适度行动，谨慎为上。';
    } else if (analysis.score >= 40) {
      return '用神平平，力量一般，建议观望为主，不宜大动。';
    } else if (analysis.score >= 20) {
      return '用神失力，处境不利，建议保守行事，等待时机。';
    } else {
      return '用神大失力，极为不利，应暂缓行动，另寻良机。';
    }
  };

  return (
    <Card
      title={
        <Space>
          <AimOutlined />
          用神分析
          <Tag color="purple">{QUESTION_TYPE_NAMES[analysis.questionType]}</Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {/* 用神评分 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>用神综合评分</Text>
            <Progress
              percent={analysis.score}
              strokeColor={FORTUNE_COLORS[analysis.fortune]}
              format={(percent) => (
                <span>
                  {percent} 分 - {FORTUNE_NAMES[analysis.fortune]}
                </span>
              )}
            />
          </Space>
        </Col>
      </Row>

      {/* 主用神信息 */}
      <Descriptions
        title={
          <Space>
            <StarOutlined />
            <Text strong>主用神</Text>
          </Space>
        }
        column={2}
        size="small"
        bordered
        style={{ marginBottom: 16 }}
      >
        <Descriptions.Item label="用神类型" span={2}>
          <Tag color="blue">{YONG_SHEN_TYPE_NAMES[analysis.primaryType]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="所在宫位">
          <Tag color="purple">{JIU_GONG_NAMES[analysis.primaryGong]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="旺衰状态">
          <Tag color={getWangShuaiColor(analysis.wangShuai)}>
            {WANG_SHUAI_STATUS_NAMES[analysis.wangShuai]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="得力情况" span={2}>
          <Tag color={getDeLiColor(analysis.deLi)}>
            <ThunderboltOutlined /> {DE_LI_STATUS_NAMES[analysis.deLi]}
          </Tag>
        </Descriptions.Item>
      </Descriptions>

      {/* 次用神信息（如果有） */}
      {analysis.secondaryType && analysis.secondaryGong && (
        <Descriptions
          title={
            <Space>
              <StarOutlined />
              <Text strong>次用神</Text>
            </Space>
          }
          column={2}
          size="small"
          bordered
          style={{ marginBottom: 16 }}
        >
          <Descriptions.Item label="用神类型" span={2}>
            <Tag color="cyan">{YONG_SHEN_TYPE_NAMES[analysis.secondaryType]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="所在宫位" span={2}>
            <Tag color="purple">{JIU_GONG_NAMES[analysis.secondaryGong]}</Tag>
          </Descriptions.Item>
        </Descriptions>
      )}

      {/* 用神建议 */}
      <Alert
        message="用神分析建议"
        description={
          <Paragraph style={{ marginBottom: 0 }}>
            <InfoCircleOutlined /> {getYongShenAdvice()}
          </Paragraph>
        }
        type={analysis.score >= 60 ? 'success' : analysis.score >= 40 ? 'warning' : 'error'}
        showIcon
      />
    </Card>
  );
};
