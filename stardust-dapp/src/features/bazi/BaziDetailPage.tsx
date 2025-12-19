/**
 * 八字排盘详情页面 - 链端生成版
 *
 * 架构说明：
 * - 八字数据和解盘结果完全由链端生成
 * - 前端只负责展示，不进行任何八字计算
 * - 通过 Runtime API 免费获取解盘结果
 *
 * 功能：
 * - 展示已保存的八字命盘详情
 * - 展示链端生成的解盘结果
 * - 提供AI解读入口
 * - 提供大师服务入口
 * - 集成悬赏问答功能
 * - NFT铸造功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Divider,
  Tag,
  Row,
  Col,
  Statistic,
  message,
  Spin,
  Empty,
  Result,
} from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  RobotOutlined,
  GiftOutlined,
  ShareAltOutlined,
  StarOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';

import {
  Gender,
  GENDER_NAMES,
} from '../../types/bazi';
import {
  getBaziChart,
  getInterpretation,
  type OnChainBaziChart,
  type V3FullInterpretation,
} from '../../services/baziChainService';
import { CreateBountyModal } from '../bounty/components/CreateBountyModal';
import { BasicInterpretationCard } from './components/BasicInterpretationCard';
import { DivinationType } from '../../types/divination';
import { useWalletStore } from '../../stores/walletStore';
import './BaziPage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 八字详情页面组件
 */
const BaziDetailPage: React.FC = () => {
  // 从URL hash中提取八字ID
  const hashMatch = window.location.hash.match(/#\/bazi\/(\d+)/);
  const baziId = hashMatch ? parseInt(hashMatch[1]) : null;

  // 状态
  const [chartData, setChartData] = useState<OnChainBaziChart | null>(null);
  const [interpretation, setInterpretation] = useState<V3FullInterpretation | null>(null);
  const [loading, setLoading] = useState(true);
  const [bountyModalVisible, setBountyModalVisible] = useState(false);

  // 从钱包store获取用户账户
  const { selectedAccount } = useWalletStore();

  // 检查baziId是否有效（注意：链上ID从0开始，所以0是有效的）
  if (baziId === null || isNaN(baziId) || baziId < 0) {
    return (
      <div className="bazi-page">
        <Card>
          <Empty
            description="无效的八字ID"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={() => window.location.hash = '#/bazi'}>
              返回排盘页面
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  /**
   * 加载八字数据（完全依赖链端）
   */
  const loadBaziData = useCallback(async () => {
    setLoading(true);
    try {
      // 从链上获取八字命盘基本信息
      const chart = await getBaziChart(baziId);

      if (!chart) {
        message.error('未找到该八字命盘');
        setLoading(false);
        return;
      }

      setChartData(chart);

      // 通过 Runtime API 获取链上生成的完整解盘（免费）
      const interp = await getInterpretation(baziId);
      if (interp) {
        setInterpretation(interp);
      }

      setLoading(false);
    } catch (error) {
      console.error('加载八字数据失败:', error);
      message.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setLoading(false);
    }
  }, [baziId]);

  useEffect(() => {
    loadBaziData();
  }, [loadBaziData]);

  /**
   * 请求AI解读
   */
  const handleRequestAi = useCallback(() => {
    window.location.hash = `#/divination/ai/${baziId}?type=${DivinationType.Bazi}`;
  }, [baziId]);

  /**
   * 找大师解读
   */
  const handleFindMaster = useCallback(() => {
    window.location.hash = `#/divination/market?type=${DivinationType.Bazi}&resultId=${baziId}`;
  }, [baziId]);

  /**
   * 铸造NFT
   */
  const handleMintNft = useCallback(() => {
    window.location.hash = `#/divination/nft/mint?type=${DivinationType.Bazi}&resultId=${baziId}`;
  }, [baziId]);

  /**
   * 分享八字命盘
   */
  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#/bazi/${baziId}`;
    const shareText = chartData
      ? `查看我的八字命盘 #${baziId}`
      : `查看我的八字命盘`;

    // 尝试使用 Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: '八字命盘',
          text: shareText,
          url: shareUrl,
        });
        message.success('分享成功');
      } catch (error) {
        // 用户取消分享，不显示错误
        if ((error as Error).name !== 'AbortError') {
          console.error('分享失败:', error);
          copyToClipboard(shareUrl);
        }
      }
    } else {
      // 降级到复制链接
      copyToClipboard(shareUrl);
    }
  }, [baziId, chartData]);

  /**
   * 复制到剪贴板
   */
  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        message.success('链接已复制到剪贴板');
      }).catch(() => {
        message.error('复制失败，请手动复制');
      });
    } else {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        message.success('链接已复制到剪贴板');
      } catch (err) {
        message.error('复制失败，请手动复制');
      }
      document.body.removeChild(textarea);
    }
  };

  /**
   * 渲染链上解盘核心信息
   */
  const renderInterpretationCore = () => {
    if (!interpretation) return null;

    const { core } = interpretation;

    return (
      <Card className="interpretation-card" size="small" style={{ marginTop: 16 }}>
        <Title level={5}>命盘解析（链端生成）</Title>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic title="格局" value={core.geJu} valueStyle={{ fontSize: 16 }} />
            </Col>
            <Col span={12}>
              <Statistic title="强弱" value={core.qiangRuo} valueStyle={{ fontSize: 16 }} />
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic
                title="用神"
                value={core.yongShen}
                valueStyle={{ fontSize: 16, color: '#52c41a' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="喜神"
                value={core.xiShen}
                valueStyle={{ fontSize: 16, color: '#1890ff' }}
              />
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic
                title="忌神"
                value={core.jiShen}
                valueStyle={{ fontSize: 16, color: '#ff4d4f' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="综合评分"
                value={core.score}
                suffix="分"
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
          </Row>
          <Divider style={{ margin: '8px 0' }} />
          <div>
            <Text strong>用神类型：</Text>
            <Tag color="blue">{core.yongShenType}</Tag>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              可信度: {core.confidence}% | 算法版本: v{core.algorithmVersion}
            </Text>
          </div>
        </Space>
      </Card>
    );
  };

  /**
   * 渲染性格分析
   */
  const renderXingGeAnalysis = () => {
    if (!interpretation || !interpretation.xingGe) return null;

    const { xingGe } = interpretation;

    return (
      <Card className="xingge-card" size="small" style={{ marginTop: 16 }}>
        <Title level={5}>性格分析</Title>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {xingGe.zhuYaoTeDian.length > 0 && (
            <div>
              <Text strong>主要特点：</Text>
              <div style={{ marginTop: 8 }}>
                {xingGe.zhuYaoTeDian.map((trait, idx) => (
                  <Tag key={idx} color="blue" style={{ marginBottom: 4 }}>
                    {trait}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          {xingGe.youDian.length > 0 && (
            <div>
              <Text strong>优点：</Text>
              <div style={{ marginTop: 8 }}>
                {xingGe.youDian.map((trait, idx) => (
                  <Tag key={idx} color="green" style={{ marginBottom: 4 }}>
                    {trait}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          {xingGe.queDian.length > 0 && (
            <div>
              <Text strong>缺点：</Text>
              <div style={{ marginTop: 8 }}>
                {xingGe.queDian.map((trait, idx) => (
                  <Tag key={idx} color="orange" style={{ marginBottom: 4 }}>
                    {trait}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          {xingGe.shiHeZhiYe.length > 0 && (
            <div>
              <Text strong>适合职业：</Text>
              <div style={{ marginTop: 8 }}>
                {xingGe.shiHeZhiYe.map((career, idx) => (
                  <Tag key={idx} color="purple" style={{ marginBottom: 4 }}>
                    {career}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </Space>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="bazi-page">
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" tip="加载八字命盘..." />
        </div>
      </div>
    );
  }

  return (
    <div className="bazi-page">
      {/* 返回按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => window.location.hash = '#/bazi'}
        >
          返回排盘
        </Button>
        {chartData && (
          <Button
            icon={<ShareAltOutlined />}
            onClick={handleShare}
          >
            分享
          </Button>
        )}
      </div>

      {/* 无数据时显示提示 */}
      {!chartData && (
        <Result
          icon={<CalendarOutlined style={{ color: '#1890ff' }} />}
          title="八字命盘不存在"
          subTitle={`八字ID: ${baziId}`}
          extra={[
            <Button
              key="back"
              type="primary"
              onClick={() => window.location.hash = '#/bazi'}
            >
              返回排盘页面
            </Button>,
          ]}
        />
      )}

      {/* 结果展示区域（有数据时显示） */}
      {chartData && (
        <>
          {/* 基本信息 */}
          <Card className="info-card" size="small">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="出生日期"
                  value={`${chartData.birthYear}/${chartData.birthMonth}/${chartData.birthDay}`}
                  valueStyle={{ fontSize: 14 }}
                  prefix={<CalendarOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="性别"
                  value={chartData.gender === 0 ? '女' : '男'}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="出生时辰"
                  value={`${chartData.birthHour}时`}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="当前年龄"
                  value={`${new Date().getFullYear() - chartData.birthYear}岁`}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <div className="bazi-summary">
              <Text strong>命盘ID：</Text>
              <Text code style={{ fontSize: 16 }}>#{chartData.id}</Text>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                创建者: {chartData.creator.slice(0, 8)}...
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                创建于区块 #{chartData.createdAt}
              </Text>
            </div>
          </Card>

          {/* V2 精简版解盘（BasicInterpretationCard 组件） */}
          {baziId !== null && (
            <div style={{ marginTop: 16 }}>
              <BasicInterpretationCard
                chartId={baziId}
                onRequestAi={handleRequestAi}
              />
            </div>
          )}

          {/* 链上解盘核心信息 */}
          {renderInterpretationCore()}

          {/* 性格分析 */}
          {renderXingGeAnalysis()}

          {/* 解读服务 */}
          <Card title="获取专业解读" className="service-card" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type="primary"
                icon={<RobotOutlined />}
                size="large"
                block
                onClick={handleRequestAi}
                style={{
                  background: 'linear-gradient(135deg, #B2955D 0%, #9A7D4A 100%)',
                  borderColor: 'transparent',
                }}
              >
                AI 智能解读
              </Button>
              <Text type="secondary" className="service-hint" style={{ marginTop: -8 }}>
                基于大语言模型，提供个性化、深度的命理分析
              </Text>

              <Button
                icon={<UserOutlined />}
                size="large"
                block
                onClick={handleFindMaster}
                style={{
                  borderColor: '#1890ff',
                  color: '#1890ff',
                }}
              >
                找大师人工解读
              </Button>
              <Text type="secondary" className="service-hint" style={{ marginTop: -8 }}>
                由认证命理师提供一对一专业咨询
              </Text>

              <Button
                icon={<GiftOutlined />}
                size="large"
                block
                onClick={() => setBountyModalVisible(true)}
                style={{ borderColor: '#faad14', color: '#faad14' }}
              >
                发起悬赏问答
              </Button>
              <Text type="secondary" className="service-hint" style={{ marginTop: -8 }}>
                设置悬赏金额，邀请多位大师解读，投票选出最佳答案
              </Text>

              <Divider style={{ margin: '8px 0' }} />

              <Button
                icon={<StarOutlined />}
                size="middle"
                block
                onClick={handleMintNft}
                type="dashed"
              >
                铸造 NFT 收藏
              </Button>
              <Text type="secondary" className="service-hint" style={{ marginTop: -8, fontSize: 11 }}>
                将您的八字命盘铸造为链上 NFT，永久保存
              </Text>
            </Space>
          </Card>
        </>
      )}

      {/* 悬赏问答弹窗 */}
      <CreateBountyModal
        visible={bountyModalVisible}
        divinationType={DivinationType.Bazi}
        resultId={baziId}
        userAccount={selectedAccount?.address || ''}
        onCancel={() => setBountyModalVisible(false)}
        onSuccess={(bountyId) => {
          setBountyModalVisible(false);
          message.success('悬赏创建成功！');
          window.location.hash = `#/bounty/${bountyId}`;
        }}
      />
    </div>
  );
};

export default BaziDetailPage;
