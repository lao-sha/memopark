/**
 * 奇门遁甲核心解卦卡片组件
 *
 * 功能：
 * - 显示核心解卦结果（格局、吉凶、旺衰等）
 * - 显示值符值使和用神宫位
 * - 显示可信度和特殊格局
 * - 提供刷新功能
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Alert,
  Button,
  Progress,
  Spin,
  Space,
  Divider,
  Typography,
  Tooltip,
} from 'antd';
import {
  ThunderboltOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  StarOutlined,
  CompassOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getCoreInterpretation } from '../../../services/qimenService';
import type { QimenCoreInterpretation } from '../../../types/qimen';
import {
  GE_JU_TYPE_NAMES,
  FORTUNE_NAMES,
  FORTUNE_COLORS,
  WANG_SHUAI_STATUS_NAMES,
  JIU_XING_NAMES,
  BA_MEN_NAMES,
  JIU_GONG_NAMES,
} from '../../../types/qimen';

const { Text, Paragraph } = Typography;

interface Props {
  chartId: number;
  onRequestDetail?: () => void;
}

export const CoreInterpretationCard: React.FC<Props> = ({
  chartId,
  onRequestDetail,
}) => {
  const [interpretation, setInterpretation] =
    useState<QimenCoreInterpretation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInterpretation();
  }, [chartId]);

  /**
   * 加载核心解卦结果
   */
  const loadInterpretation = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getCoreInterpretation(chartId);

      if (result) {
        setInterpretation(result);
      } else {
        setError('无法获取解卦结果，请确认排盘存在');
      }
    } catch (err: any) {
      console.error('加载解卦失败:', err);
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取特殊格局列表
   */
  const getSpecialPatterns = (patterns: number): string[] => {
    const list: string[] = [];
    if (patterns & (1 << 0)) list.push('伏吟');
    if (patterns & (1 << 1)) list.push('反吟');
    if (patterns & (1 << 2)) list.push('天遁');
    if (patterns & (1 << 3)) list.push('地遁');
    if (patterns & (1 << 4)) list.push('人遁');
    if (patterns & (1 << 5)) list.push('鬼遁');
    if (patterns & (1 << 6)) list.push('神遁');
    if (patterns & (1 << 7)) list.push('龙遁');
    return list;
  };

  /**
   * 获取宫位名称
   */
  const getGongName = (gongNum: number): string => {
    if (gongNum < 1 || gongNum > 9) return '未知';
    const gongMap: Record<number, string> = {
      1: JIU_GONG_NAMES.Kan || '坎',
      2: JIU_GONG_NAMES.Kun || '坤',
      3: JIU_GONG_NAMES.Zhen || '震',
      4: JIU_GONG_NAMES.Xun || '巽',
      5: JIU_GONG_NAMES.Zhong || '中',
      6: JIU_GONG_NAMES.Qian || '乾',
      7: JIU_GONG_NAMES.Dui || '兑',
      8: JIU_GONG_NAMES.Gen || '艮',
      9: JIU_GONG_NAMES.Li || '离',
    };
    return gongMap[gongNum] || '未知';
  };

  if (loading) {
    return (
      <Card title="核心解卦" style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="正在计算解卦..." />
        </div>
      </Card>
    );
  }

  if (error || !interpretation) {
    return (
      <Card title="核心解卦" style={{ marginBottom: 16 }}>
        <Alert
          message="加载失败"
          description={error || '未知错误'}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={loadInterpretation}>
              重试
            </Button>
          }
        />
      </Card>
    );
  }

  const specialPatterns = getSpecialPatterns(interpretation.specialPatterns);

  return (
    <Card
      title={
        <Space>
          <StarOutlined />
          核心解卦
          <Tag color={FORTUNE_COLORS[interpretation.fortune]}>
            {FORTUNE_NAMES[interpretation.fortune]}
          </Tag>
        </Space>
      }
      extra={
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={loadInterpretation}
        >
          刷新
        </Button>
      }
      style={{ marginBottom: 16 }}
    >
      {/* 吉凶评分 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>综合吉凶评分</Text>
            <Progress
              percent={interpretation.fortuneScore}
              strokeColor={FORTUNE_COLORS[interpretation.fortune]}
              format={(percent) => `${percent} 分`}
            />
          </Space>
        </Col>
      </Row>

      <Divider />

      {/* 格局信息 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8}>
          <Statistic
            title="格局类型"
            value={GE_JU_TYPE_NAMES[interpretation.geJu]}
            prefix={<CompassOutlined />}
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
        <Col xs={12} sm={8}>
          <Statistic
            title="旺衰状态"
            value={WANG_SHUAI_STATUS_NAMES[interpretation.wangShuai]}
            prefix={<ThunderboltOutlined />}
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
        <Col xs={12} sm={8}>
          <Statistic
            title="可信度"
            value={interpretation.confidence}
            suffix="%"
            prefix={<SafetyOutlined />}
            valueStyle={{ fontSize: 16 }}
          />
        </Col>
      </Row>

      <Divider />

      {/* 值符值使 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12}>
          <Space direction="vertical" size="small">
            <Text type="secondary">值符（当值之星）</Text>
            <Tag color="blue" style={{ fontSize: 14 }}>
              {JIU_XING_NAMES[interpretation.zhiFuXing]}
            </Tag>
          </Space>
        </Col>
        <Col xs={12} sm={12}>
          <Space direction="vertical" size="small">
            <Text type="secondary">值使（当值之门）</Text>
            <Tag color="green" style={{ fontSize: 14 }}>
              {BA_MEN_NAMES[interpretation.zhiShiMen]}
            </Tag>
          </Space>
        </Col>
      </Row>

      <Divider />

      {/* 用神宫位 */}
      <Row gutter={[16, 16]}>
        <Col xs={8}>
          <Space direction="vertical" size="small">
            <Text type="secondary">用神宫</Text>
            <Tag color="purple" style={{ fontSize: 14 }}>
              {interpretation.yongShenGong}宫 {getGongName(interpretation.yongShenGong)}
            </Tag>
          </Space>
        </Col>
        <Col xs={8}>
          <Space direction="vertical" size="small">
            <Text type="secondary">日干宫</Text>
            <Tag color="orange" style={{ fontSize: 14 }}>
              {interpretation.riGanGong}宫 {getGongName(interpretation.riGanGong)}
            </Tag>
          </Space>
        </Col>
        <Col xs={8}>
          <Space direction="vertical" size="small">
            <Text type="secondary">时干宫</Text>
            <Tag color="cyan" style={{ fontSize: 14 }}>
              {interpretation.shiGanGong}宫 {getGongName(interpretation.shiGanGong)}
            </Tag>
          </Space>
        </Col>
      </Row>

      {/* 特殊格局 */}
      {specialPatterns.length > 0 && (
        <>
          <Divider />
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text strong>
              <InfoCircleOutlined /> 特殊格局
            </Text>
            <Space wrap>
              {specialPatterns.map((pattern, index) => (
                <Tag key={index} color="gold">
                  {pattern}
                </Tag>
              ))}
            </Space>
          </Space>
        </>
      )}

      {/* 元数据 */}
      <Divider />
      <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Tooltip title="解盘时的区块号">
          <Text type="secondary">
            <ClockCircleOutlined /> 区块 #{interpretation.timestamp}
          </Text>
        </Tooltip>
        <Text type="secondary">算法版本 v{interpretation.algorithmVersion}</Text>
      </Space>

      {/* 引导查看详细解读 */}
      {onRequestDetail && (
        <>
          <Divider />
          <Alert
            message="查看完整解读"
            description="点击下方按钮查看九宫详解、用神分析、应期推算等完整内容"
            type="info"
            showIcon
            action={
              <Button type="primary" onClick={onRequestDetail}>
                查看详情
              </Button>
            }
          />
        </>
      )}
    </Card>
  );
};
