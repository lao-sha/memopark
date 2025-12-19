/**
 * 大六壬式盘详情页面
 *
 * 展示大六壬排盘结果，包括：
 * - 四课三传
 * - 天地盘
 * - 核心解盘
 * - 完整解盘（可选）
 */

import React, { useEffect, useState } from 'react';
import { Card, Button, Typography, Space, Spin, Tag, Divider, Row, Col, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getPan, getCoreInterpretation, formatGanZhi } from '../../services/daliurenService';
import { DaLiuRenPan, CoreInterpretation } from '../../types/daliuren';
import { DI_ZHI_NAMES, TIAN_GAN_NAMES } from '../../types/daliuren';

const { Title, Text, Paragraph } = Typography;

/**
 * 吉凶等级颜色
 */
const FORTUNE_COLORS = ['#ff4d4f', '#ff7a45', '#ffa940', '#faad14', '#52c41a', '#1890ff', '#722ed1'];
const FORTUNE_NAMES = ['大凶', '凶', '偏凶', '平', '偏吉', '吉', '大吉'];

/**
 * 大六壬详情页面
 */
const DaliurenDetailPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [pan, setPan] = useState<DaLiuRenPan | null>(null);
  const [interpretation, setInterpretation] = useState<CoreInterpretation | null>(null);

  // 从URL获取式盘ID
  const panId = parseInt(window.location.hash.split('/').pop() || '0');

  useEffect(() => {
    loadPan();
  }, [panId]);

  /**
   * 加载式盘数据
   */
  const loadPan = async () => {
    try {
      setLoading(true);

      if (!panId || isNaN(panId)) {
        message.error('无效的式盘ID');
        return;
      }

      // 加载式盘基础数据
      const panData = await getPan(panId);
      if (!panData) {
        message.error('式盘不存在');
        return;
      }
      setPan(panData);

      // 加载核心解盘
      const interpretationData = await getCoreInterpretation(panId);
      setInterpretation(interpretationData);

    } catch (error: any) {
      console.error('加载式盘失败:', error);
      message.error(error?.message || '加载式盘失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '12px', maxWidth: '414px', paddingBottom: '80px', minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto', textAlign: 'center', paddingTop: '100px' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!pan) {
    return (
      <div style={{ padding: '12px', maxWidth: '414px', paddingBottom: '80px', minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto' }}>
        <Card>
          <Text>式盘不存在</Text>
          <br />
          <Button onClick={() => window.history.back()}>返回</Button>
        </Card>
      </div>
    );
  }

  // 格式化干支
  const yearGzStr = formatGanZhi(pan.yearGz);
  const monthGzStr = formatGanZhi(pan.monthGz);
  const dayGzStr = formatGanZhi(pan.dayGz);
  const hourGzStr = formatGanZhi(pan.hourGz);

  return (
    <div style={{ padding: '12px', maxWidth: '414px', paddingBottom: '80px', minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto' }}>
      {/* 页面标题 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => window.history.back()}
          >
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>大六壬式盘</Title>
          <Text type="secondary">式盘 ID: {panId}</Text>
        </Space>
      </Card>

      {/* 四柱信息 */}
      <Card title="四柱干支" style={{ marginBottom: '16px' }}>
        <Row gutter={[8, 8]}>
          <Col span={6}>
            <Text type="secondary">年柱</Text>
            <br />
            <Text strong style={{ fontSize: '18px' }}>{yearGzStr}</Text>
          </Col>
          <Col span={6}>
            <Text type="secondary">月柱</Text>
            <br />
            <Text strong style={{ fontSize: '18px' }}>{monthGzStr}</Text>
          </Col>
          <Col span={6}>
            <Text type="secondary">日柱</Text>
            <br />
            <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>{dayGzStr}</Text>
          </Col>
          <Col span={6}>
            <Text type="secondary">时柱</Text>
            <br />
            <Text strong style={{ fontSize: '18px' }}>{hourGzStr}</Text>
          </Col>
        </Row>
        <Divider style={{ margin: '12px 0' }} />
        <Space>
          <Tag color="blue">月将：{DI_ZHI_NAMES[pan.yueJiang]}</Tag>
          <Tag color="purple">占时：{DI_ZHI_NAMES[pan.zhanShi]}</Tag>
          <Tag>{pan.isDay ? '昼占' : '夜占'}</Tag>
        </Space>
      </Card>

      {/* 四课 */}
      <Card title="四课" style={{ marginBottom: '16px' }}>
        <Row gutter={[8, 12]}>
          {Object.entries(pan.siKe).map(([key, ke], index) => (
            <Col span={12} key={key}>
              <Card size="small" title={`第${['一', '二', '三', '四'][index]}课`}>
                <div style={{ textAlign: 'center' }}>
                  <Tag color="blue" style={{ margin: '2px', fontSize: '14px' }}>
                    {DI_ZHI_NAMES[ke.shang]}
                  </Tag>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>↓</Text>
                  <br />
                  <Tag style={{ margin: '2px', fontSize: '14px' }}>
                    {DI_ZHI_NAMES[ke.xia]}
                  </Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 三传 */}
      <Card title="三传" style={{ marginBottom: '16px' }}>
        <Row gutter={[16, 8]} justify="center">
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">初传</Text>
              <br />
              <Tag color="green" style={{ fontSize: '16px', padding: '6px 12px' }}>
                {DI_ZHI_NAMES[pan.sanChuan.chu]}
              </Tag>
              <br />
              <Text style={{ fontSize: '12px' }}>起因</Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">中传</Text>
              <br />
              <Tag color="orange" style={{ fontSize: '16px', padding: '6px 12px' }}>
                {DI_ZHI_NAMES[pan.sanChuan.zhong]}
              </Tag>
              <br />
              <Text style={{ fontSize: '12px' }}>过程</Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">末传</Text>
              <br />
              <Tag color="red" style={{ fontSize: '16px', padding: '6px 12px' }}>
                {DI_ZHI_NAMES[pan.sanChuan.mo]}
              </Tag>
              <br />
              <Text style={{ fontSize: '12px' }}>结果</Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 核心解盘 */}
      {interpretation && (
        <Card title="核心解盘" style={{ marginBottom: '16px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* 吉凶判断 */}
            <div>
              <Text strong>吉凶等级：</Text>
              <Tag color={FORTUNE_COLORS[interpretation.fortune]} style={{ fontSize: '16px', padding: '4px 12px' }}>
                {FORTUNE_NAMES[interpretation.fortune]}
              </Tag>
            </div>

            {/* 综合评分 */}
            <div>
              <Text strong>综合评分：</Text>
              <Text style={{ fontSize: '18px', color: interpretation.score >= 70 ? '#52c41a' : interpretation.score >= 50 ? '#faad14' : '#ff4d4f' }}>
                {interpretation.score} 分
              </Text>
            </div>

            <Divider style={{ margin: 0 }} />

            {/* 趋势分析 */}
            <div>
              <Text strong>趋势分析：</Text>
              <br />
              <Tag color={interpretation.trend === 0 ? '#ff4d4f' : interpretation.trend === 1 ? '#1890ff' : '#52c41a'}>
                {['递减', '平稳', '递增'][interpretation.trend]}
              </Tag>
            </div>

            {/* 结果预测 */}
            <div>
              <Text strong>结果预测：</Text>
              <br />
              <Tag>
                {['不利', '难测', '有利'][interpretation.outcome]}
              </Tag>
            </div>

            {/* 应期 */}
            {interpretation.yingQiNum > 0 && (
              <div>
                <Text strong>应期：</Text>
                <br />
                <Text>
                  {interpretation.yingQiNum}{['日', '月', '年', '时', '旬', '季'][interpretation.yingQiUnit]}内
                </Text>
              </div>
            )}
          </Space>
        </Card>
      )}

      {/* 问题描述 */}
      {pan.questionCid && (
        <Card title="问题描述" style={{ marginBottom: '16px' }}>
          <Paragraph>{pan.questionCid}</Paragraph>
        </Card>
      )}

      {/* 操作按钮 */}
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button block type="primary" onClick={() => message.info('AI解读功能开发中')}>
            请求 AI 详细解读
          </Button>
          <Button block onClick={() => message.info('分享功能开发中')}>
            分享式盘
          </Button>
          <Button block onClick={() => message.info('收藏功能开发中')}>
            收藏式盘
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default DaliurenDetailPage;
