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
  TIAN_GAN_NAMES,
  DI_ZHI_NAMES,
  TianGan,
  DiZhi,
  TIAN_GAN_WU_XING,
  DI_ZHI_WU_XING,
  WuXing,
  WU_XING_NAMES,
  WU_XING_COLORS,
  SHI_SHEN_NAMES,
  ShiShen,
  SHI_ER_CHANG_SHENG_NAMES,
  ShiErChangSheng,
  SHEN_SHA_NAMES,
  ShenSha,
  SiZhuPosition,
  type FullBaziChartV5,
  type EnhancedZhu,
  type KongWangInfo,
  type XingYunInfo,
  type ShenShaEntryV5,
} from '../../types/bazi';
import {
  getBaziChart,
  getInterpretation,
  getFullBaziChart,
  getFullBaziChartV5,
  type OnChainBaziChart,
  type V3FullInterpretation,
  type FullBaziChart,
  type SiZhuData,
  type ZhuFullData,
  type CangGanInfo,
} from '../../services/baziChainService';
import { CreateBountyModal } from '../bounty/components/CreateBountyModal';
import { BasicInterpretationCard } from './components/BasicInterpretationCard';
import { DivinationType } from '../../types/divination';
import { useWalletStore } from '../../stores/walletStore';
import {
  KeyManagement,
  ProviderRegistration,
  ChartAuthorization,
  GrantedCharts,
} from './components/v6';
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
  const [fullChartData, setFullChartData] = useState<FullBaziChart | null>(null);
  const [fullChartDataV5, setFullChartDataV5] = useState<FullBaziChartV5 | null>(null);
  const [interpretation, setInterpretation] = useState<V3FullInterpretation | null>(null);
  const [loading, setLoading] = useState(true);
  const [bountyModalVisible, setBountyModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'chart' | 'advanced' | 'auth' | 'notes'>('basic');

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
      // 从链上获取完整八字命盘信息（包含四柱）
      const fullChart = await getFullBaziChart(baziId);

      if (!fullChart) {
        message.error('未找到该八字命盘');
        setLoading(false);
        return;
      }

      setFullChartData(fullChart);
      setChartData(fullChart);

      // 通过 Runtime API 获取完整命盘 V5（包含星运、空亡、神煞）
      const fullChartV5 = await getFullBaziChartV5(baziId);
      if (fullChartV5) {
        setFullChartDataV5(fullChartV5);
        console.log('[BaziDetailPage] V5 完整命盘数据:', fullChartV5);
      }

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

  /**
   * 获取五行对应的 emoji
   */
  const getWuXingEmoji = (wuXing: WuXing): string => {
    const emojiMap: Record<WuXing, string> = {
      [WuXing.Mu]: '🌳',
      [WuXing.Huo]: '🔥',
      [WuXing.Tu]: '🏔️',
      [WuXing.Jin]: '🪙',
      [WuXing.Shui]: '💧',
    };
    return emojiMap[wuXing];
  };

  /**
   * 十神名称映射表（链上枚举名到中文）
   */
  const shiShenNameMap: Record<string, string> = {
    'BiJian': '比肩',
    'JieCai': '劫财',
    'ShiShen': '食神',
    'ShangGuan': '伤官',
    'ZhengCai': '正财',
    'PianCai': '偏财',
    'ZhengGuan': '正官',
    'QiSha': '七杀',
    'ZhengYin': '正印',
    'PianYin': '偏印',
  };

  /**
   * 获取十神中文名称
   */
  const getShiShenName = (shiShen: string): string => {
    return shiShenNameMap[shiShen] || shiShen || '-';
  };

  /**
   * 纳音名称映射表（链上枚举名到中文）
   */
  const naYinNameMap: Record<string, string> = {
    'HaiZhongJin': '海中金',
    'LuZhongHuo': '炉中火',
    'DaLinMu': '大林木',
    'LuPangTu': '路旁土',
    'JianFengJin': '剑锋金',
    'ShanTouHuo': '山头火',
    'JianXiaShui': '涧下水',
    'ChengTouTu': '城头土',
    'BaiLaJin': '白蜡金',
    'YangLiuMu': '杨柳木',
    'QuanZhongShui': '泉中水',
    'WuShangTu': '屋上土',
    'PiLiHuo': '霹雳火',
    'SongBaiMu': '松柏木',
    'ChangLiuShui': '长流水',
    'ShaZhongJin': '沙中金',
    'ShanXiaHuo': '山下火',
    'PingDiMu': '平地木',
    'BiShangTu': '壁上土',
    'JinBoJin': '金箔金',
    'FuDengHuo': '覆灯火',
    'TianHeShui': '天河水',
    'DaYiTu': '大驿土',
    'ChaiChuanJin': '钗钏金',
    'SangTuoMu': '桑柘木',
    'DaXiShui': '大溪水',
    'ShaZhongTu': '沙中土',
    'TianShangHuo': '天上火',
    'ShiLiuMu': '石榴木',
    'DaHaiShui': '大海水',
  };

  /**
   * 获取纳音中文名称
   */
  const getNaYinName = (naYin: string): string => {
    return naYinNameMap[naYin] || naYin || '-';
  };

  /**
   * 获取十二长生中文名称（星运）
   */
  const getChangShengName = (changSheng: ShiErChangSheng | undefined): string => {
    if (changSheng === undefined || changSheng === null) return '-';
    return SHI_ER_CHANG_SHENG_NAMES[changSheng] || '-';
  };

  /**
   * 获取空亡显示文本
   * @param kongWangPair 空亡地支对（两个地支）
   * @param isKong 该柱地支是否落空亡
   */
  const getKongWangDisplay = (kongWangPair: [DiZhi, DiZhi] | undefined, isKong: boolean | undefined): string => {
    if (!kongWangPair) return '-';
    const zhi1 = DI_ZHI_NAMES[kongWangPair[0]];
    const zhi2 = DI_ZHI_NAMES[kongWangPair[1]];
    const kongMark = isKong ? '◎' : '';
    return `${zhi1}${zhi2}${kongMark}`;
  };

  /**
   * 获取神煞显示文本（按柱位置分组）
   */
  const getShenShaByPosition = (position: SiZhuPosition): string => {
    if (!fullChartDataV5?.shenShaList) return '-';
    const shenShaList = fullChartDataV5.shenShaList.filter(s => s.position === position);
    if (shenShaList.length === 0) return '-';
    return shenShaList.map(s => SHEN_SHA_NAMES[s.shenSha] || '-').join(' ');
  };

  /**
   * 获取主星显示文本（天干十神 + 地支本气十神）
   * @param zhu 增强柱数据
   * @param isRiZhu 是否为日柱（日柱显示"元命"）
   */
  const getZhuXingDisplay = (zhu: EnhancedZhu | undefined, isRiZhu: boolean = false): string => {
    if (isRiZhu) return '元命';
    if (!zhu) return '-';

    // 天干十神
    const tianGanShiShen = SHI_SHEN_NAMES[zhu.tianGanShiShen];
    // 地支本气十神
    const diZhiBenQi = SHI_SHEN_NAMES[zhu.diZhiBenQiShiShen];

    // 如果两者相同，只显示一次
    if (tianGanShiShen === diZhiBenQi) {
      return tianGanShiShen;
    }

    // 否则显示 "天干十神/地支十神" 的形式
    return `${tianGanShiShen}/${diZhiBenQi}`;
  };

  /**
   * 获取藏干显示文本（多个藏干用逗号分隔）
   */
  const getCangGanDisplay = (zhuData: ZhuFullData | undefined): string => {
    if (!zhuData || !zhuData.cangGan || zhuData.cangGan.length === 0) {
      return '-';
    }
    // 只显示藏干天干
    return zhuData.cangGan
      .map((cg: CangGanInfo) => TIAN_GAN_NAMES[cg.gan as TianGan] || '-')
      .join(' ');
  };

  /**
   * 获取副星（藏干十神）显示文本
   */
  const getFuXingDisplay = (zhuData: ZhuFullData | undefined): string => {
    if (!zhuData || !zhuData.cangGan || zhuData.cangGan.length === 0) {
      return '-';
    }
    // 显示藏干的十神关系
    return zhuData.cangGan
      .map((cg: CangGanInfo) => getShiShenName(cg.shiShen))
      .join(' ');
  };

  /**
   * 渲染四柱表格（使用链上数据）
   */
  const renderSiZhuTable = () => {
    if (!fullChartData?.siZhu) return null;

    const { siZhu } = fullChartData;

    // 获取天干地支名称
    const yearGan = TIAN_GAN_NAMES[siZhu.yearGan as TianGan];
    const yearZhi = DI_ZHI_NAMES[siZhu.yearZhi as DiZhi];
    const monthGan = TIAN_GAN_NAMES[siZhu.monthGan as TianGan];
    const monthZhi = DI_ZHI_NAMES[siZhu.monthZhi as DiZhi];
    const dayGan = TIAN_GAN_NAMES[siZhu.dayGan as TianGan];
    const dayZhi = DI_ZHI_NAMES[siZhu.dayZhi as DiZhi];
    const hourGan = TIAN_GAN_NAMES[siZhu.hourGan as TianGan];
    const hourZhi = DI_ZHI_NAMES[siZhu.hourZhi as DiZhi];

    // 获取五行
    const yearGanWuXing = TIAN_GAN_WU_XING[siZhu.yearGan as TianGan];
    const yearZhiWuXing = DI_ZHI_WU_XING[siZhu.yearZhi as DiZhi];
    const monthGanWuXing = TIAN_GAN_WU_XING[siZhu.monthGan as TianGan];
    const monthZhiWuXing = DI_ZHI_WU_XING[siZhu.monthZhi as DiZhi];
    const dayGanWuXing = TIAN_GAN_WU_XING[siZhu.dayGan as TianGan];
    const dayZhiWuXing = DI_ZHI_WU_XING[siZhu.dayZhi as DiZhi];
    const hourGanWuXing = TIAN_GAN_WU_XING[siZhu.hourGan as TianGan];
    const hourZhiWuXing = DI_ZHI_WU_XING[siZhu.hourZhi as DiZhi];

    return (
      <div style={{
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #e8e8e8',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#B2955D' }}>
              <th style={{ padding: '10px 8px', color: '#fff', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #e8e8e8' }}>日期</th>
              <th style={{ padding: '10px 8px', color: '#fff', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e8e8e8' }}>年柱</th>
              <th style={{ padding: '10px 8px', color: '#fff', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e8e8e8' }}>月柱</th>
              <th style={{ padding: '10px 8px', color: '#fff', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e8e8e8' }}>日柱</th>
              <th style={{ padding: '10px 8px', color: '#fff', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e8e8e8' }}>时柱</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>天干</td>
              <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                <span style={{ fontSize: '18px', color: WU_XING_COLORS[yearGanWuXing], fontWeight: 500 }}>{yearGan}</span>
                <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(yearGanWuXing)}</span>
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                <span style={{ fontSize: '18px', color: WU_XING_COLORS[monthGanWuXing], fontWeight: 500 }}>{monthGan}</span>
                <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(monthGanWuXing)}</span>
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                <span style={{ fontSize: '18px', color: WU_XING_COLORS[dayGanWuXing], fontWeight: 500 }}>{dayGan}</span>
                <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(dayGanWuXing)}</span>
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                <span style={{ fontSize: '18px', color: WU_XING_COLORS[hourGanWuXing], fontWeight: 500 }}>{hourGan}</span>
                <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(hourGanWuXing)}</span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>地支</td>
              <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                <span style={{ fontSize: '18px', color: WU_XING_COLORS[yearZhiWuXing], fontWeight: 500 }}>{yearZhi}</span>
                <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(yearZhiWuXing)}</span>
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                <span style={{ fontSize: '18px', color: WU_XING_COLORS[monthZhiWuXing], fontWeight: 500 }}>{monthZhi}</span>
                <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(monthZhiWuXing)}</span>
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                <span style={{ fontSize: '18px', color: WU_XING_COLORS[dayZhiWuXing], fontWeight: 500 }}>{dayZhi}</span>
                <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(dayZhiWuXing)}</span>
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                <span style={{ fontSize: '18px', color: WU_XING_COLORS[hourZhiWuXing], fontWeight: 500 }}>{hourZhi}</span>
                <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(hourZhiWuXing)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
      {/* 顶部导航栏 - 显示标题 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '414px',
        backgroundColor: '#ffffff',
        zIndex: 101,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 16px',
        height: '50px',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
        borderBottom: '1px solid #e8e8e8',
      }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => window.location.hash = '#/bazi'}
          style={{ color: '#333', padding: '4px 8px' }}
        />
        <div style={{
          fontSize: '16px',
          fontWeight: '500',
          color: '#333',
          textAlign: 'center',
        }}>
          八字玄鉴
        </div>
        {chartData && (
          <Button
            type="text"
            icon={<ShareAltOutlined />}
            onClick={handleShare}
            style={{ color: '#333', padding: '4px 8px' }}
          />
        )}
        {!chartData && <div style={{ width: '32px' }}></div>}
      </div>

      {/* 标签导航栏 */}
      <div style={{
        position: 'fixed',
        top: '50px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '414px',
        backgroundColor: '#1a1a1a',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
      }}>
        <div style={{ display: 'flex', gap: 0, width: '100%' }}>
          {[
            { key: 'basic' as const, label: '基本信息' },
            { key: 'chart' as const, label: '基本排盘' },
            { key: 'advanced' as const, label: '专业细盘' },
            { key: 'auth' as const, label: '授权管理' },
            { key: 'notes' as const, label: '断事笔记' },
          ].map(tab => (
            <span
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '6px',
                fontSize: '18px',
                backgroundColor: activeTab === tab.key ? '#B2955D' : 'transparent',
                color: '#fff',
                cursor: 'pointer',
                borderRadius: '4px',
                fontWeight: '400',
                transition: 'all 0.3s',
                userSelect: 'none',
                lineHeight: '1.2',
                flex: 1,
                textAlign: 'center',
              }}
            >
              {tab.label}
            </span>
          ))}
        </div>
      </div>

      {/* 顶部占位 */}
      <div style={{ height: '80px' }}></div>

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
          {/* 基本信息 - 根据activeTab显示不同内容 */}
          {activeTab === 'basic' && (
            <Card className="info-card" size="small" style={{
              background: '#ffffff',
              border: '1px solid #e8e8e8',
              marginTop: 16,
            }}>
              {/* 圆形图标和案例编号 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: 24,
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #B2955D 0%, #D4AF7A 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                  boxShadow: '0 4px 12px rgba(178, 149, 93, 0.4)',
                }}>
                  <CalendarOutlined style={{ fontSize: '32px', color: '#fff' }} />
                  <div style={{ fontSize: '12px', color: '#fff', marginTop: 4 }}>
                    案例{chartData.id}
                  </div>
                </div>
              </div>

              {/* 阴历阳历显示 */}
              <div style={{
                backgroundColor: '#f7f7f7',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: 16,
              }}>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: '#B2955D', fontSize: 14 }}>阴历:</Text>
                  <Text style={{ color: '#333', fontSize: 15 }}>
                    {chartData.birthYear}年{chartData.birthMonth}月初一 辰时
                  </Text>
                  <Tag color="gold" style={{ fontSize: 11 }}>(老浩)</Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: '#B2955D', fontSize: 14 }}>阳历:</Text>
                  <Text style={{ color: '#333', fontSize: 15 }}>
                    {chartData.birthYear}年{chartData.birthMonth}月{chartData.birthDay}日 08:56
                  </Text>
                </div>
              </div>

              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title={<span style={{ color: '#999' }}>出生日期</span>}
                    value={`${chartData.birthYear}/${chartData.birthMonth}/${chartData.birthDay}`}
                    valueStyle={{ fontSize: 14, color: '#333' }}
                    prefix={<CalendarOutlined style={{ color: '#B2955D' }} />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={<span style={{ color: '#999' }}>性别</span>}
                    value={GENDER_NAMES[chartData.gender as Gender] || '未知'}
                    valueStyle={{ fontSize: 14, color: '#333' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={<span style={{ color: '#999' }}>出生时辰</span>}
                    value={`${chartData.birthHour}时`}
                    valueStyle={{ fontSize: 14, color: '#333' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={<span style={{ color: '#999' }}>当前年龄</span>}
                    value={`${new Date().getFullYear() - chartData.birthYear}岁`}
                    valueStyle={{ fontSize: 14, color: '#333' }}
                  />
                </Col>
              </Row>
              <Divider style={{ margin: '12px 0', borderColor: '#e8e8e8' }} />
              <div className="bazi-summary">
                <Text strong style={{ color: '#B2955D' }}>命盘ID：</Text>
                <Text code style={{ fontSize: 16, background: '#f7f7f7', color: '#333', border: '1px solid #e8e8e8' }}>#{chartData.id}</Text>
              </div>
              <Divider style={{ margin: '12px 0', borderColor: '#e8e8e8' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12, color: '#999' }}>
                  创建者: {chartData.creator.slice(0, 8)}...
                </Text>
                <Text type="secondary" style={{ fontSize: 12, color: '#999' }}>
                  创建于区块 #{chartData.createdAt}
                </Text>
              </div>
            </Card>
          )}

          {/* 基本排盘标签 - 四柱八字表格 */}
          {activeTab === 'chart' && (
            <>
              {/* 案例信息卡片 */}
              <Card
                size="small"
                style={{
                  marginTop: 0,
                  background: '#1a1a1a',
                  border: 'none',
                  borderRadius: 0,
                  width: '414px',
                  maxWidth: '100%',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}>
                  {/* 圆形图标 */}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #B2955D 0%, #D4AF7A 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxShadow: '0 4px 12px rgba(178, 149, 93, 0.4)',
                    flexShrink: 0,
                  }}>
                    <CalendarOutlined style={{ fontSize: '24px', color: '#fff' }} />
                    <div style={{ fontSize: '11px', color: '#fff', marginTop: 2 }}>
                      案例{chartData.id}
                    </div>
                  </div>

                  {/* 阴历阳历显示 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 4 }}>
                      <Text style={{ color: '#B2955D', fontSize: 13 }}>阴历: </Text>
                      <Text style={{ color: '#fff', fontSize: 14 }}>
                        {chartData.birthYear}年{chartData.birthMonth}月初一 辰时
                      </Text>
                      <Tag color="gold" style={{ fontSize: 10, marginLeft: 8 }}>(老浩)</Tag>
                    </div>
                    <div>
                      <Text style={{ color: '#B2955D', fontSize: 13 }}>阳历: </Text>
                      <Text style={{ color: '#fff', fontSize: 14 }}>
                        {chartData.birthYear}年{chartData.birthMonth}月{chartData.birthDay}日 08:56
                      </Text>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 四柱八字表格卡片 */}
              <Card
                size="small"
                style={{
                  marginTop: 16,
                  background: '#ffffff',
                  border: '1px solid #e8e8e8',
                }}
              >
              <div style={{
                backgroundColor: '#f9f9f9',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #e8e8e8',
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#B2955D' }}>
                      <th style={{ padding: '10px 8px', color: '#fff', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #e8e8e8' }}>日期</th>
                      <th style={{ padding: '10px 8px', color: '#fff', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e8e8e8' }}>年柱</th>
                      <th style={{ padding: '10px 8px', color: '#fff', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e8e8e8' }}>月柱</th>
                      <th style={{ padding: '10px 8px', color: '#fff', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e8e8e8' }}>日柱</th>
                      <th style={{ padding: '10px 8px', color: '#fff', textAlign: 'center', fontWeight: 500, borderBottom: '1px solid #e8e8e8' }}>时柱</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 主星行 - 使用 V5 数据 */}
                    <tr>
                      <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>主星</td>
                      <td style={{ padding: '10px 8px', color: '#333', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        {getZhuXingDisplay(fullChartDataV5?.siZhu?.yearZhu)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#333', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        {getZhuXingDisplay(fullChartDataV5?.siZhu?.monthZhu)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#333', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        {getZhuXingDisplay(fullChartDataV5?.siZhu?.dayZhu, true)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#333', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        {getZhuXingDisplay(fullChartDataV5?.siZhu?.hourZhu)}
                      </td>
                    </tr>
                    {/* 天干行 - 使用链上数据 */}
                    <tr>
                      <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>天干</td>
                      {fullChartData?.siZhu ? (
                        <>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                            <span style={{ fontSize: '18px', color: WU_XING_COLORS[TIAN_GAN_WU_XING[fullChartData.siZhu.yearGan as TianGan]], fontWeight: 500 }}>
                              {TIAN_GAN_NAMES[fullChartData.siZhu.yearGan as TianGan]}
                            </span>
                            <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(TIAN_GAN_WU_XING[fullChartData.siZhu.yearGan as TianGan])}</span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                            <span style={{ fontSize: '18px', color: WU_XING_COLORS[TIAN_GAN_WU_XING[fullChartData.siZhu.monthGan as TianGan]], fontWeight: 500 }}>
                              {TIAN_GAN_NAMES[fullChartData.siZhu.monthGan as TianGan]}
                            </span>
                            <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(TIAN_GAN_WU_XING[fullChartData.siZhu.monthGan as TianGan])}</span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                            <span style={{ fontSize: '18px', color: WU_XING_COLORS[TIAN_GAN_WU_XING[fullChartData.siZhu.dayGan as TianGan]], fontWeight: 500 }}>
                              {TIAN_GAN_NAMES[fullChartData.siZhu.dayGan as TianGan]}
                            </span>
                            <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(TIAN_GAN_WU_XING[fullChartData.siZhu.dayGan as TianGan])}</span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                            <span style={{ fontSize: '18px', color: WU_XING_COLORS[TIAN_GAN_WU_XING[fullChartData.siZhu.hourGan as TianGan]], fontWeight: 500 }}>
                              {TIAN_GAN_NAMES[fullChartData.siZhu.hourGan as TianGan]}
                            </span>
                            <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(TIAN_GAN_WU_XING[fullChartData.siZhu.hourGan as TianGan])}</span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>-</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>-</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>-</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>-</td>
                        </>
                      )}
                    </tr>
                    {/* 地支行 - 使用链上数据 */}
                    <tr>
                      <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>地支</td>
                      {fullChartData?.siZhu ? (
                        <>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                            <span style={{ fontSize: '18px', color: WU_XING_COLORS[DI_ZHI_WU_XING[fullChartData.siZhu.yearZhi as DiZhi]], fontWeight: 500 }}>
                              {DI_ZHI_NAMES[fullChartData.siZhu.yearZhi as DiZhi]}
                            </span>
                            <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(DI_ZHI_WU_XING[fullChartData.siZhu.yearZhi as DiZhi])}</span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                            <span style={{ fontSize: '18px', color: WU_XING_COLORS[DI_ZHI_WU_XING[fullChartData.siZhu.monthZhi as DiZhi]], fontWeight: 500 }}>
                              {DI_ZHI_NAMES[fullChartData.siZhu.monthZhi as DiZhi]}
                            </span>
                            <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(DI_ZHI_WU_XING[fullChartData.siZhu.monthZhi as DiZhi])}</span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                            <span style={{ fontSize: '18px', color: WU_XING_COLORS[DI_ZHI_WU_XING[fullChartData.siZhu.dayZhi as DiZhi]], fontWeight: 500 }}>
                              {DI_ZHI_NAMES[fullChartData.siZhu.dayZhi as DiZhi]}
                            </span>
                            <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(DI_ZHI_WU_XING[fullChartData.siZhu.dayZhi as DiZhi])}</span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>
                            <span style={{ fontSize: '18px', color: WU_XING_COLORS[DI_ZHI_WU_XING[fullChartData.siZhu.hourZhi as DiZhi]], fontWeight: 500 }}>
                              {DI_ZHI_NAMES[fullChartData.siZhu.hourZhi as DiZhi]}
                            </span>
                            <span style={{ fontSize: '11px', marginLeft: 4 }}>{getWuXingEmoji(DI_ZHI_WU_XING[fullChartData.siZhu.hourZhi as DiZhi])}</span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>-</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>-</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>-</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>-</td>
                        </>
                      )}
                    </tr>
                    {/* 藏干行 - 使用链上数据 */}
                    <tr>
                      <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>藏干</td>
                      <td style={{ padding: '10px 8px', color: '#333', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        <div>{getCangGanDisplay(fullChartData?.siZhu?.yearZhu)}</div>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#333', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        <div>{getCangGanDisplay(fullChartData?.siZhu?.monthZhu)}</div>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#333', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        <div>{getCangGanDisplay(fullChartData?.siZhu?.dayZhu)}</div>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#333', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        <div>{getCangGanDisplay(fullChartData?.siZhu?.hourZhu)}</div>
                      </td>
                    </tr>
                    {/* 副星行 - 使用链上藏干十神数据 */}
                    <tr>
                      <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>副星</td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid #e8e8e8' }}>
                        {getFuXingDisplay(fullChartData?.siZhu?.yearZhu)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid #e8e8e8' }}>
                        {getFuXingDisplay(fullChartData?.siZhu?.monthZhu)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid #e8e8e8' }}>
                        {getFuXingDisplay(fullChartData?.siZhu?.dayZhu)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid #e8e8e8' }}>
                        {getFuXingDisplay(fullChartData?.siZhu?.hourZhu)}
                      </td>
                    </tr>
                    {/* 星运行 - 使用 V5 数据 */}
                    <tr>
                      <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>星运</td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        {getChangShengName(fullChartDataV5?.xingYun?.yearChangSheng)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        {getChangShengName(fullChartDataV5?.xingYun?.monthChangSheng)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        {getChangShengName(fullChartDataV5?.xingYun?.dayChangSheng)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid #e8e8e8' }}>
                        {getChangShengName(fullChartDataV5?.xingYun?.hourChangSheng)}
                      </td>
                    </tr>
                    {/* 白羊行 - 链上暂无数据 */}
                    <tr>
                      <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>白羊</td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>-</td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>-</td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>-</td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>-</td>
                    </tr>
                    {/* 空亡行 - 使用 V5 数据 */}
                    <tr>
                      <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>空亡</td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid #e8e8e8' }}>
                        {getKongWangDisplay(fullChartDataV5?.kongWang?.yearKongWang, fullChartDataV5?.kongWang?.yearIsKong)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid #e8e8e8' }}>
                        {getKongWangDisplay(fullChartDataV5?.kongWang?.monthKongWang, fullChartDataV5?.kongWang?.monthIsKong)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid #e8e8e8' }}>
                        {getKongWangDisplay(fullChartDataV5?.kongWang?.dayKongWang, fullChartDataV5?.kongWang?.dayIsKong)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid #e8e8e8' }}>
                        {getKongWangDisplay(fullChartDataV5?.kongWang?.hourKongWang, fullChartDataV5?.kongWang?.hourIsKong)}
                      </td>
                    </tr>
                    {/* 纳音行 - 使用链上数据 */}
                    <tr>
                      <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>纳音</td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        {getNaYinName(fullChartData?.siZhu?.yearZhu?.naYin || '')}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        {getNaYinName(fullChartData?.siZhu?.monthZhu?.naYin || '')}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        {getNaYinName(fullChartData?.siZhu?.dayZhu?.naYin || '')}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '11px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        {getNaYinName(fullChartData?.siZhu?.hourZhu?.naYin || '')}
                      </td>
                    </tr>
                    {/* 神煞行 - 使用 V5 数据 */}
                    <tr>
                      <td style={{ padding: '10px 8px', color: '#666', borderBottom: '1px solid #e8e8e8' }}>神煞</td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '10px', lineHeight: '1.4' }}>
                        {getShenShaByPosition(SiZhuPosition.Year)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '10px', lineHeight: '1.4' }}>
                        {getShenShaByPosition(SiZhuPosition.Month)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '10px', lineHeight: '1.4' }}>
                        {getShenShaByPosition(SiZhuPosition.Day)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#B2955D', textAlign: 'center', fontSize: '10px', lineHeight: '1.4' }}>
                        {getShenShaByPosition(SiZhuPosition.Hour)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16, fontSize: '12px', color: '#999', textAlign: 'center' }}>
                以下小于等于8岁，仅供自己或长辈，博弈。十年等待后学孤独。
              </div>
              </Card>
            </>
          )}

          {/* V2 精简版解盘（BasicInterpretationCard 组件） - 只在基本信息标签显示 */}
          {activeTab === 'basic' && baziId !== null && (
            <div style={{ marginTop: 16 }}>
              <BasicInterpretationCard
                chartId={baziId}
                onRequestAi={handleRequestAi}
              />
            </div>
          )}

          {/* 链上解盘核心信息 - 只在基本信息标签显示 */}
          {activeTab === 'basic' && renderInterpretationCore()}

          {/* 性格分析 - 只在基本信息标签显示 */}
          {activeTab === 'basic' && renderXingGeAnalysis()}

          {/* 专业细盘标签 */}
          {activeTab === 'advanced' && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Empty
                description="专业细盘功能开发中..."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          )}

          {/* V6 授权管理标签 */}
          {activeTab === 'auth' && (
            <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="middle">
              {/* 密钥管理组件 */}
              <KeyManagement
                compact={false}
                onKeyRegistered={(publicKey) => {
                  console.log('已注册公钥:', publicKey);
                  message.success('加密公钥已注册');
                }}
              />

              {/* 服务提供者注册组件 */}
              <ProviderRegistration
                compact={false}
                onRegistered={(providerType) => {
                  console.log('已注册为服务提供者:', providerType);
                }}
              />

              {/* 命盘授权管理组件（仅当当前命盘属于用户时显示） */}
              {chartData && selectedAccount?.address === chartData.creator && (
                <ChartAuthorization
                  chartId={baziId!}
                  onAuthorizationChanged={() => {
                    console.log('授权已变更');
                    loadBaziData();
                  }}
                />
              )}

              {/* 被授权的命盘列表（命理师视角） */}
              <GrantedCharts
                onViewChart={(chartId, decryptedData) => {
                  console.log('查看命盘:', chartId, decryptedData);
                  // 可以跳转到详情页或显示模态框
                }}
              />
            </Space>
          )}

          {/* 断事笔记标签 */}
          {activeTab === 'notes' && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Empty
                description="断事笔记功能开发中..."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          )}

          {/* 解读服务 - 只在基本信息标签显示 */}
          {activeTab === 'basic' && (
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
          )}
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
