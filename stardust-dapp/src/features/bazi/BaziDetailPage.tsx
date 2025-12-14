/**
 * 八字排盘详情页面
 *
 * 功能：
 * - 展示已保存的八字命盘详情
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
  Collapse,
} from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  RobotOutlined,
  GiftOutlined,
  ShareAltOutlined,
  StarOutlined,
  ArrowLeftOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

import {
  Gender,
  GENDER_NAMES,
  TIAN_GAN_NAMES,
  DI_ZHI_NAMES,
  WU_XING_NAMES,
  WU_XING_COLORS,
  WU_XING_BG_COLORS,
  SHI_SHEN_SHORT,
  SHI_SHEN_COLORS,
  BaziResult,
  ZhuDetail,
  DaYun,
  getGanZhiName,
} from '../../types/bazi';
import { calculateBazi, calculateLiuNian, formatBazi } from '../../services/baziService';
import {
  getBaziChart,
  downloadBaziResultFromIpfs,
  interpretBaziOnChain,
  getOnChainInterpretation,
  type OnChainBaziChart,
  type OnChainInterpretation,
} from '../../services/baziChainService';
import { CreateBountyModal } from '../bounty/components/CreateBountyModal';
import { BasicInterpretationCard } from './components/BasicInterpretationCard';
import { DivinationType } from '../../types/divination';
import { useWalletStore } from '../../stores/walletStore';
import './BaziPage.css';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

/**
 * 八字详情页面组件
 */
const BaziDetailPage: React.FC = () => {
  // 从URL hash中提取八字ID
  const hashMatch = window.location.hash.match(/#\/bazi\/(\d+)/);
  const baziId = hashMatch ? parseInt(hashMatch[1]) : null;

  // 状态
  const [result, setResult] = useState<BaziResult | null>(null);
  const [chartData, setChartData] = useState<OnChainBaziChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [bountyModalVisible, setBountyModalVisible] = useState(false);

  // 链上解盘状态
  const [interpretation, setInterpretation] = useState<OnChainInterpretation | null>(null);
  const [interpreting, setInterpreting] = useState(false);

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
   * 加载八字数据
   * 优化后的加载逻辑：优先使用链上数据计算，减少对IPFS的依赖
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

      // 根据链上基本信息计算八字（主要数据来源）
      const baziInput = {
        year: chart.birthYear,
        month: chart.birthMonth,
        day: chart.birthDay,
        hour: chart.birthHour,
        gender: chart.gender as Gender,
      };

      const calculatedResult = calculateBazi(baziInput);
      setResult(calculatedResult);

      // 可选：尝试从IPFS加载补充数据（不阻塞主流程）
      if (chart.dataCid) {
        downloadBaziResultFromIpfs(chart.dataCid)
          .then((ipfsResult) => {
            if (ipfsResult) {
              console.log('[BaziDetailPage] IPFS数据加载成功，作为补充');
              // 可以合并一些IPFS的额外数据
            }
          })
          .catch((err) => {
            console.warn('[BaziDetailPage] IPFS数据加载失败，使用计算结果:', err);
          });
      }

      // 加载链上解盘结果（旧版，保留兼容）
      const onChainInterpretation = await getOnChainInterpretation(baziId);
      if (onChainInterpretation) {
        setInterpretation(onChainInterpretation);
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
    const shareText = result
      ? `我的八字命盘：${formatBazi(result.siZhu)}`
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
  }, [baziId, result]);

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
   * 执行链上解盘
   */
  const handleInterpretOnChain = useCallback(async () => {
    if (!selectedAccount) {
      message.warning('请先连接钱包');
      return;
    }

    if (interpretation) {
      message.info('该八字已经解盘过了，可以直接查看结果');
      return;
    }

    setInterpreting(true);
    try {
      await interpretBaziOnChain(baziId!);
      message.success('链上解盘成功！');

      // 重新加载解盘结果
      const newInterpretation = await getOnChainInterpretation(baziId!);
      setInterpretation(newInterpretation);
    } catch (error) {
      console.error('链上解盘失败:', error);
      message.error(`解盘失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setInterpreting(false);
    }
  }, [baziId, selectedAccount, interpretation]);

  /**
   * 渲染单柱
   */
  const renderZhu = (
    title: string,
    detail: ZhuDetail,
    isRiZhu: boolean = false
  ) => {
    const { ganZhi, tianGanShiShen, cangGan, cangGanShiShen, tianGanWuXing, diZhiWuXing } = detail;

    return (
      <div className="zhu-column">
        <div className="zhu-title">{title}</div>

        {/* 天干十神 */}
        <div className="shi-shen-row">
          {isRiZhu ? (
            <Tag color="purple">日主</Tag>
          ) : tianGanShiShen !== null ? (
            <Tag color={SHI_SHEN_COLORS[tianGanShiShen]}>
              {SHI_SHEN_SHORT[tianGanShiShen]}
            </Tag>
          ) : null}
        </div>

        {/* 天干 */}
        <div
          className="gan-box"
          style={{
            backgroundColor: WU_XING_BG_COLORS[tianGanWuXing],
            borderColor: WU_XING_COLORS[tianGanWuXing],
          }}
        >
          <span className="gan-text">{TIAN_GAN_NAMES[ganZhi.tianGan]}</span>
          <span className="wu-xing-label" style={{ color: WU_XING_COLORS[tianGanWuXing] }}>
            {WU_XING_NAMES[tianGanWuXing]}
          </span>
        </div>

        {/* 地支 */}
        <div
          className="zhi-box"
          style={{
            backgroundColor: WU_XING_BG_COLORS[diZhiWuXing],
            borderColor: WU_XING_COLORS[diZhiWuXing],
          }}
        >
          <span className="zhi-text">{DI_ZHI_NAMES[ganZhi.diZhi]}</span>
          <span className="wu-xing-label" style={{ color: WU_XING_COLORS[diZhiWuXing] }}>
            {WU_XING_NAMES[diZhiWuXing]}
          </span>
        </div>

        {/* 藏干 */}
        <div className="cang-gan-section">
          {cangGan.map((g, idx) => (
            <div key={idx} className="cang-gan-item">
              <span className="cang-gan-name">{TIAN_GAN_NAMES[g]}</span>
              <Tag color={SHI_SHEN_COLORS[cangGanShiShen[idx]]} style={{ fontSize: 11 }}>
                {SHI_SHEN_SHORT[cangGanShiShen[idx]]}
              </Tag>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 渲染五行统计
   */
  const renderWuXingStats = () => {
    if (!result) return null;
    const { wuXingCount, wuXingLack } = result;

    const items = [
      { name: '木', count: wuXingCount.mu, color: WU_XING_COLORS[0], bg: WU_XING_BG_COLORS[0] },
      { name: '火', count: wuXingCount.huo, color: WU_XING_COLORS[1], bg: WU_XING_BG_COLORS[1] },
      { name: '土', count: wuXingCount.tu, color: WU_XING_COLORS[2], bg: WU_XING_BG_COLORS[2] },
      { name: '金', count: wuXingCount.jin, color: WU_XING_COLORS[3], bg: WU_XING_BG_COLORS[3] },
      { name: '水', count: wuXingCount.shui, color: WU_XING_COLORS[4], bg: WU_XING_BG_COLORS[4] },
    ];

    return (
      <Card className="wu-xing-card" size="small">
        <Title level={5}>五行统计</Title>
        <div className="wu-xing-bars">
          {items.map((item) => (
            <div key={item.name} className="wu-xing-bar-item">
              <div className="bar-label">
                <span style={{ color: item.color }}>{item.name}</span>
                <span>{item.count}</span>
              </div>
              <div className="bar-track" style={{ backgroundColor: item.bg }}>
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.min(item.count * 12.5, 100)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {wuXingLack.length > 0 && (
          <div className="wu-xing-lack">
            <Text type="secondary">五行缺：</Text>
            {wuXingLack.map((wx) => (
              <Tag key={wx} color="warning">
                {WU_XING_NAMES[wx]}
              </Tag>
            ))}
          </div>
        )}
      </Card>
    );
  };

  /**
   * 渲染大运（折叠面板）
   */
  const renderDaYun = () => {
    if (!result) return null;
    const { daYunList, qiYunAge, daYunShun } = result;

    return (
      <Collapse defaultActiveKey={['dayun']} style={{ marginTop: 16 }}>
        <Panel
          header={
            <Space>
              <span style={{ fontWeight: 500 }}>大运</span>
              <Tag color={daYunShun ? 'blue' : 'orange'}>
                {daYunShun ? '顺行' : '逆行'}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{qiYunAge}岁起运</Text>
            </Space>
          }
          key="dayun"
        >
          <div className="da-yun-list">
            {daYunList.slice(0, 10).map((dy: DaYun) => (
              <div key={dy.index} className="da-yun-item">
                <div className="da-yun-age">{dy.startAge}-{dy.endAge}</div>
                <div className="da-yun-gan-zhi">
                  <span className="gan">{TIAN_GAN_NAMES[dy.ganZhi.tianGan]}</span>
                  <span className="zhi">{DI_ZHI_NAMES[dy.ganZhi.diZhi]}</span>
                </div>
                <Tag color={SHI_SHEN_COLORS[dy.tianGanShiShen]} style={{ fontSize: 11 }}>
                  {SHI_SHEN_SHORT[dy.tianGanShiShen]}
                </Tag>
              </div>
            ))}
          </div>
        </Panel>
      </Collapse>
    );
  };

  /**
   * 渲染流年（折叠面板）
   */
  const renderLiuNian = () => {
    if (!result) return null;

    const currentYear = new Date().getFullYear();
    const liuNianList = calculateLiuNian(
      result.siZhu,
      result.birthInfo.year,
      currentYear,
      15 // 显示前后共15年
    );

    return (
      <Collapse style={{ marginTop: 16 }}>
        <Panel
          header={
            <Space>
              <span style={{ fontWeight: 500 }}>流年</span>
              <Text type="secondary" style={{ fontSize: 12 }}>近15年运势</Text>
            </Space>
          }
          key="liunian"
        >
          <div className="liu-nian-list">
            {liuNianList.map((ln) => (
              <div
                key={ln.year}
                className={`liu-nian-item ${ln.year === currentYear ? 'current' : ''}`}
              >
                <div className="liu-nian-year">
                  {ln.year}
                  {ln.year === currentYear && (
                    <Tag color="red" style={{ marginLeft: 4, fontSize: 10 }}>本年</Tag>
                  )}
                </div>
                <div className="liu-nian-gan-zhi">{getGanZhiName(ln.ganZhi)}</div>
                <Tag color={SHI_SHEN_COLORS[ln.tianGanShiShen]} style={{ fontSize: 11 }}>
                  {SHI_SHEN_SHORT[ln.tianGanShiShen]}
                </Tag>
                <div className="liu-nian-age">{ln.age}岁</div>
              </div>
            ))}
          </div>
        </Panel>
      </Collapse>
    );
  };

  /**
   * 渲染链上解盘结果（V1 完整版）
   */
  const renderOnChainInterpretation = () => {
    if (!interpretation) return null;

    return (
      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#faad14' }} />
            <span>链上解盘结果</span>
            <Tag color="gold">V1 完整版</Tag>
          </Space>
        }
        className="interpretation-card"
        size="small"
        style={{ marginTop: 16 }}
      >
        {/* 核心指标 */}
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card type="inner" size="small">
              <Statistic
                title="格局"
                value={interpretation.geJu}
                valueStyle={{ fontSize: 18, color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card type="inner" size="small">
              <Statistic
                title="命局强弱"
                value={interpretation.qiangRuo}
                valueStyle={{ fontSize: 18, color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card type="inner" size="small">
              <Statistic
                title="用神"
                value={interpretation.yongShen}
                valueStyle={{ fontSize: 18, color: '#f5222d' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {interpretation.yongShenType}
              </Text>
            </Card>
          </Col>
          <Col span={12}>
            <Card type="inner" size="small">
              <Statistic
                title="综合评分"
                value={interpretation.score}
                suffix="/100"
                valueStyle={{ fontSize: 18, color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 忌神 */}
        {interpretation.jiShen.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>忌神：</Text>
            <Space size={4} style={{ marginLeft: 8 }}>
              {interpretation.jiShen.map((ji, idx) => (
                <Tag key={idx} color="volcano">{ji}</Tag>
              ))}
            </Space>
          </div>
        )}

        {/* 性格分析 */}
        {interpretation.xingGe && (
          <div style={{ marginTop: 16 }}>
            <Divider orientation="left">性格分析</Divider>

            {/* 主要性格特点 */}
            {interpretation.xingGe.zhuYaoTeDian.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text strong>主要特点：</Text>
                <Space size={4} style={{ marginLeft: 8, flexWrap: 'wrap' }}>
                  {interpretation.xingGe.zhuYaoTeDian.map((trait, idx) => (
                    <Tag key={idx} color="blue">{trait}</Tag>
                  ))}
                </Space>
              </div>
            )}

            {/* 优点 */}
            {interpretation.xingGe.youDian.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text strong>优点：</Text>
                <Space size={4} style={{ marginLeft: 8, flexWrap: 'wrap' }}>
                  {interpretation.xingGe.youDian.map((trait, idx) => (
                    <Tag key={idx} color="green">{trait}</Tag>
                  ))}
                </Space>
              </div>
            )}

            {/* 缺点 */}
            {interpretation.xingGe.queDian.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text strong>缺点：</Text>
                <Space size={4} style={{ marginLeft: 8, flexWrap: 'wrap' }}>
                  {interpretation.xingGe.queDian.map((trait, idx) => (
                    <Tag key={idx} color="orange">{trait}</Tag>
                  ))}
                </Space>
              </div>
            )}

            {/* 适合职业 */}
            {interpretation.xingGe.shiHeZhiYe.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text strong>适合职业：</Text>
                <Space size={4} style={{ marginLeft: 8, flexWrap: 'wrap' }}>
                  {interpretation.xingGe.shiHeZhiYe.map((career, idx) => (
                    <Tag key={idx} color="purple">{career}</Tag>
                  ))}
                </Space>
              </div>
            )}
          </div>
        )}

        {/* 解盘详情 */}
        {interpretation.texts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Divider orientation="left">解盘详情</Divider>
            {interpretation.texts.map((text, idx) => (
              <Paragraph key={idx} style={{ marginBottom: 8 }}>
                {idx + 1}. {text}
              </Paragraph>
            ))}
          </div>
        )}
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

  // 开发阶段显示占位页面
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
        {result && (
          <Button
            icon={<ShareAltOutlined />}
            onClick={handleShare}
          >
            分享
          </Button>
        )}
      </div>

      {/* 无数据时显示提示 */}
      {!result && (
        <Result
          icon={<CalendarOutlined style={{ color: '#1890ff' }} />}
          title="八字详情页"
          subTitle={chartData ? `命盘ID: ${baziId} | 创建者: ${chartData.creator.slice(0, 8)}...` : `八字ID: ${baziId}`}
          extra={[
            <Button
              key="bounty"
              type="primary"
              icon={<GiftOutlined />}
              onClick={() => setBountyModalVisible(true)}
              style={{ borderColor: '#faad14', backgroundColor: '#faad14' }}
            >
              发起悬赏问答
            </Button>,
            <Button key="ai" icon={<RobotOutlined />} onClick={handleRequestAi}>
              AI 解读
            </Button>,
            <Button key="master" icon={<UserOutlined />} onClick={handleFindMaster}>
              找大师解读
            </Button>,
            <Button key="nft" icon={<StarOutlined />} onClick={handleMintNft}>
              铸造NFT
            </Button>,
          ]}
        >
          <div className="result-content">
            <Paragraph>
              此页面用于展示已保存到链上的八字命盘详情。
            </Paragraph>
            <Paragraph type="secondary">
              功能包括：查看四柱八字、五行分析、大运流年、AI解读、大师服务、悬赏问答、NFT铸造等。
            </Paragraph>
          </div>
        </Result>
      )}

      {/* 结果展示区域（有数据时显示） */}
      {result && (
        <>
          {/* 基本信息 */}
          <Card className="info-card" size="small">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="出生日期"
                  value={`${result.birthInfo.year}/${result.birthInfo.month}/${result.birthInfo.day}`}
                  valueStyle={{ fontSize: 14 }}
                  prefix={<CalendarOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="性别"
                  value={GENDER_NAMES[result.birthInfo.gender]}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="农历"
                  value={`${result.lunarInfo.year}年${result.lunarInfo.isLeapMonth ? '闰' : ''}${result.lunarInfo.month}月${result.lunarInfo.day}日`}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="当前年龄"
                  value={`${new Date().getFullYear() - result.birthInfo.year}岁`}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <div className="bazi-summary">
              <Text strong>八字：</Text>
              <Text code style={{ fontSize: 16, fontWeight: 500 }}>{formatBazi(result.siZhu)}</Text>
            </div>
            {chartData && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    命盘ID: {chartData.id}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    创建于区块 #{chartData.createdAt}
                  </Text>
                </div>
              </>
            )}
          </Card>

          {/* 四柱详情 */}
          <Card className="si-zhu-card" size="small">
            <Title level={5}>四柱八字</Title>
            <div className="si-zhu-container">
              {renderZhu('年柱', result.siZhuDetail.nian)}
              {renderZhu('月柱', result.siZhuDetail.yue)}
              {renderZhu('日柱', result.siZhuDetail.ri, true)}
              {renderZhu('时柱', result.siZhuDetail.shi)}
            </div>
          </Card>

          {/* 五行统计 */}
          {renderWuXingStats()}

          {/* 大运 */}
          {renderDaYun()}

          {/* 流年 */}
          {renderLiuNian()}

          {/* V2 精简版解盘（优先显示） */}
          {baziId !== null && (
            <div style={{ marginTop: 16 }}>
              <BasicInterpretationCard
                chartId={baziId}
                onRequestAi={handleRequestAi}
              />
            </div>
          )}

          {/* 链上解盘结果（旧版，保留兼容） */}
          {renderOnChainInterpretation()}

          {/* 解读服务 */}
          <Card title="获取专业解读" className="service-card">
            {/* 免费链上解盘（V2精简版已经在上面展示了，这里只需要显示其他服务） */}
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type="primary"
                icon={<RobotOutlined />}
                size="large"
                block
                onClick={handleRequestAi}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
