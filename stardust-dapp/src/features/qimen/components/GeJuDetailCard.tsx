/**
 * 格局详解卡片组件
 *
 * 功能：
 * - 显示格局的详细信息
 * - 显示格局吉凶和描述
 * - 显示适用场景
 * - 显示注意事项和建议
 */

import React from 'react';
import {
  Card,
  Tag,
  Space,
  Typography,
  Alert,
  Divider,
} from 'antd';
import {
  BookOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { GeJuDetail } from '../../../types/qimen';
import {
  GE_JU_TYPE_NAMES,
  FORTUNE_NAMES,
  FORTUNE_COLORS,
  QUESTION_TYPE_NAMES,
} from '../../../types/qimen';

const { Text, Title, Paragraph } = Typography;

interface Props {
  detail: GeJuDetail;
}

export const GeJuDetailCard: React.FC<Props> = ({ detail }) => {
  /**
   * 获取格局等级
   */
  const getGeJuLevel = (): { level: string; color: string } => {
    const geJu = detail.geJu;
    if (
      geJu === 'TianDunGe' ||
      geJu === 'DiDunGe' ||
      geJu === 'RenDunGe' ||
      geJu === 'QingLongFanShou'
    ) {
      return { level: '上等吉格', color: '#52c41a' };
    } else if (geJu === 'ShenDunGe' || geJu === 'LongDunGe' || geJu === 'GuiDunGe') {
      return { level: '中等吉格', color: '#1890ff' };
    } else if (geJu === 'FuYinGe' || geJu === 'FanYinGe' || geJu === 'FeiNiaoDieXue') {
      return { level: '特殊格局', color: '#faad14' };
    } else {
      return { level: '常规格局', color: '#d9d9d9' };
    }
  };

  const geJuLevel = getGeJuLevel();

  return (
    <Card
      title={
        <Space>
          <BookOutlined />
          格局详解
          <Tag color={geJuLevel.color}>{geJuLevel.level}</Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {/* 格局名称和吉凶 */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 8 }}>
          {detail.name || GE_JU_TYPE_NAMES[detail.geJu]}
        </Title>
        <Tag
          color={FORTUNE_COLORS[detail.fortune]}
          style={{ fontSize: 16, padding: '4px 12px' }}
        >
          {FORTUNE_NAMES[detail.fortune]}
        </Tag>
      </div>

      <Divider />

      {/* 格局描述 */}
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Text strong style={{ fontSize: 16 }}>
            <InfoCircleOutlined /> 格局说明
          </Text>
          <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
            {detail.description}
          </Paragraph>
        </div>

        <Divider />

        {/* 适用场景 */}
        <div>
          <Text strong style={{ fontSize: 16 }}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} /> 适用场景
          </Text>
          <div style={{ marginTop: 8 }}>
            {detail.applicableScenarios && detail.applicableScenarios.length > 0 ? (
              <Space wrap>
                {detail.applicableScenarios.map((scenario, index) => (
                  <Tag key={index} color="blue">
                    {QUESTION_TYPE_NAMES[scenario]}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">通用于各类问事</Text>
            )}
          </div>
        </div>

        <Divider />

        {/* 注意事项 */}
        <div>
          <Alert
            message={
              <Space>
                <WarningOutlined />
                <Text strong>注意事项</Text>
              </Space>
            }
            description={
              <Paragraph style={{ marginBottom: 0, marginTop: 8 }}>
                {detail.notes}
              </Paragraph>
            }
            type="warning"
            showIcon
          />
        </div>

        {/* 格局知识补充 */}
        <Divider />
        <Alert
          message="格局知识"
          description={
            <div>
              <Paragraph>
                <Text strong>什么是格局？</Text>
                <br />
                格局是奇门遁甲中天盘、地盘、人盘、神盘四者之间的特殊组合关系，
                不同的格局代表不同的吉凶趋势和事物发展规律。
              </Paragraph>
              <Paragraph style={{ marginBottom: 0 }}>
                <Text strong>如何运用格局？</Text>
                <br />
                格局需要结合用神、旺衰、值符值使等因素综合判断，不可单凭格局论吉凶。
                同时要注意格局的适用场景，对症下药才能发挥最大效用。
              </Paragraph>
            </div>
          }
          type="info"
          showIcon
        />
      </Space>
    </Card>
  );
};
